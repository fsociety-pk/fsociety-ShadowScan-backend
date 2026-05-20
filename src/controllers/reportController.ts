import { Request, Response } from 'express';
import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import Case from '../models/Case';
import Report from '../models/Report';
import Finding from '../models/Finding';
import { logUserActivity } from '../utils/logActivity';
import { generateFullReport } from '../services/reportService';

interface AuthRequest extends Request {
  user?: any;
}

type ReportTemplate = 'fbi' | 'corporate';
type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

interface ExtractedEntity {
  type: 'email' | 'phone' | 'username' | 'domain' | 'ip' | 'person' | 'organization' | 'location';
  value: string;
  confidence: number;
  source: string;
}

interface GraphNode {
  id: string;
  label: string;
  type: ExtractedEntity['type'] | 'target';
  color: string;
}

interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  strength: 'weak' | 'medium' | 'strong';
}

interface VisualReportPayload {
  target: string;
  summary: string;
  riskLevel: RiskLevel;
  confidenceScore: number;
  tags: string[];
  entitiesByType: Record<string, string[]>;
  highlightedFindings: string[];
  relationshipGraph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
}

// Helper function to format findings for AI
const formatFindingsForAI = (findings: any[]) => {
  const grouped = findings.reduce((acc: any, finding: any) => {
    if (!acc[finding.findingType]) acc[finding.findingType] = [];
    acc[finding.findingType].push(finding);
    return acc;
  }, {});

  let formatted = '';
  for (const [type, items] of Object.entries(grouped)) {
    formatted += `\n## ${type.toUpperCase().replace(/_/g, ' ')}\n`;
    (items as any[]).forEach((item: any, idx: number) => {
      formatted += `\n### Finding ${idx + 1}\n`;
      formatted += `**Source**: ${item.source}\n`;
      formatted += `**Confidence**: ${item.confidence}%\n`;
      if (item.email) formatted += `**Email**: ${item.email}\n`;
      if (item.username) formatted += `**Username**: ${item.username}\n`;
      if (item.phone) formatted += `**Phone**: ${item.phone}\n`;
      if (item.domain) formatted += `**Domain**: ${item.domain}\n`;
      formatted += `**Data**: \`\`\`json\n${JSON.stringify(item.data, null, 2)}\n\`\`\`\n`;
    });
  }
  return formatted;
};

const normalizeRiskLevel = (raw: string | undefined): RiskLevel => {
  const value = (raw || '').toLowerCase();
  if (value.includes('critical')) return 'Critical';
  if (value.includes('high')) return 'High';
  if (value.includes('medium')) return 'Medium';
  return 'Low';
};

const confidenceToRisk = (score: number): RiskLevel => {
  if (score >= 85) return 'Critical';
  if (score >= 65) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
};

const toCleanLines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const parseEntitiesFromText = (rawText: string, source: string): ExtractedEntity[] => {
  const entities: ExtractedEntity[] = [];
  const lines = toCleanLines(rawText);

  const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  const phoneRegex = /\+?\d[\d\s\-()]{7,}\d/g;
  const domainRegex = /\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi;
  const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
  const usernameRegex = /(?:^|\s|[:(])@?([a-z0-9._-]{3,32})(?=$|\s|[),])/gi;

  const addEntity = (type: ExtractedEntity['type'], value: string, confidence: number) => {
    const cleaned = value.trim();
    if (!cleaned) return;
    entities.push({ type, value: cleaned, confidence, source });
  };

  for (const match of rawText.match(emailRegex) || []) addEntity('email', match, 90);
  for (const match of rawText.match(phoneRegex) || []) addEntity('phone', match, 84);
  for (const match of rawText.match(ipRegex) || []) addEntity('ip', match, 82);
  for (const match of rawText.match(domainRegex) || []) {
    if (!match.includes('@')) addEntity('domain', match, 80);
  }
  for (const match of rawText.matchAll(usernameRegex)) {
    const value = match[1];
    if (value && !value.includes('.')) addEntity('username', value, 76);
  }

  for (const line of lines) {
    const [labelRaw, ...rest] = line.split(':');
    if (!rest.length) continue;
    const label = labelRaw.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (!value) continue;

    if (['name', 'target', 'friend', 'alias', 'person'].includes(label)) addEntity('person', value, 78);
    if (['organization', 'org', 'employer', 'company'].includes(label)) addEntity('organization', value, 75);
    if (['location', 'city', 'address'].includes(label)) addEntity('location', value, 74);
  }

  const dedupe = new Map<string, ExtractedEntity>();
  for (const entity of entities) {
    const key = `${entity.type}::${entity.value.toLowerCase()}`;
    const existing = dedupe.get(key);
    if (!existing || existing.confidence < entity.confidence) dedupe.set(key, entity);
  }
  return Array.from(dedupe.values());
};

const buildSyntheticFindingsFromCase = (caseDoc: any): any[] => {
  const clues = Array.isArray(caseDoc.clues) ? caseDoc.clues : [];
  const targetProfile = caseDoc.targetProfile || {};
  const profileText = [
    targetProfile.name ? `name: ${targetProfile.name}` : '',
    targetProfile.email ? `email: ${targetProfile.email}` : '',
    targetProfile.phone ? `phone: ${targetProfile.phone}` : '',
    targetProfile.organization ? `organization: ${targetProfile.organization}` : '',
    targetProfile.location ? `location: ${targetProfile.location}` : '',
    targetProfile.socialMedia ? `username: ${targetProfile.socialMedia}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const rawCorpus = [caseDoc.description || '', ...clues, caseDoc.notes || '', profileText].filter(Boolean).join('\n');
  const entities = parseEntitiesFromText(rawCorpus, 'Case Dossier');
  const findings: any[] = [];

  entities.forEach((entity, idx) => {
    findings.push({
      findingType: 'other',
      source: entity.source,
      confidence: entity.confidence,
      email: entity.type === 'email' ? entity.value : undefined,
      username: entity.type === 'username' ? entity.value : undefined,
      phone: entity.type === 'phone' ? entity.value : undefined,
      domain: entity.type === 'domain' ? entity.value : undefined,
      data: {
        extractedType: entity.type,
        extractedValue: entity.value,
        clueIndex: idx + 1,
      },
    });
  });

  if (!findings.length && rawCorpus.trim()) {
    findings.push({
      findingType: 'other',
      source: 'Case Dossier',
      confidence: 70,
      data: { raw: rawCorpus.slice(0, 1000) },
    });
  }

  return findings;
};

const extractEntitiesFromFindings = (findings: any[]): ExtractedEntity[] => {
  const extracted: ExtractedEntity[] = [];
  findings.forEach((f) => {
    if (f.email) extracted.push({ type: 'email', value: f.email, confidence: f.confidence || 75, source: f.source || 'Unknown' });
    if (f.phone) extracted.push({ type: 'phone', value: f.phone, confidence: f.confidence || 75, source: f.source || 'Unknown' });
    if (f.username) extracted.push({ type: 'username', value: f.username, confidence: f.confidence || 75, source: f.source || 'Unknown' });
    if (f.domain) extracted.push({ type: 'domain', value: f.domain, confidence: f.confidence || 75, source: f.source || 'Unknown' });
    if (f.data?.ip) extracted.push({ type: 'ip', value: f.data.ip, confidence: f.confidence || 70, source: f.source || 'Unknown' });
    if (f.data?.name) extracted.push({ type: 'person', value: f.data.name, confidence: f.confidence || 72, source: f.source || 'Unknown' });
    if (f.data?.organization) extracted.push({ type: 'organization', value: f.data.organization, confidence: f.confidence || 70, source: f.source || 'Unknown' });
    if (f.data?.location) extracted.push({ type: 'location', value: f.data.location, confidence: f.confidence || 68, source: f.source || 'Unknown' });
  });

  const dedupe = new Map<string, ExtractedEntity>();
  extracted.forEach((entity) => {
    const key = `${entity.type}::${String(entity.value).toLowerCase()}`;
    const existing = dedupe.get(key);
    if (!existing || entity.confidence > existing.confidence) dedupe.set(key, entity);
  });
  return Array.from(dedupe.values());
};

const getEntityColor = (type: ExtractedEntity['type'] | 'target') => {
  const palette: Record<string, string> = {
    target: '#0ea5e9',
    person: '#8b5cf6',
    email: '#ef4444',
    phone: '#f59e0b',
    username: '#6366f1',
    domain: '#10b981',
    ip: '#06b6d4',
    organization: '#14b8a6',
    location: '#fb923c',
  };
  return palette[type] || '#64748b';
};

const buildGraph = (targetLabel: string, entities: ExtractedEntity[]) => {
  const nodes: GraphNode[] = [{ id: 'target', label: targetLabel, type: 'target', color: getEntityColor('target') }];
  const edges: GraphEdge[] = [];

  entities.slice(0, 24).forEach((entity, idx) => {
    const id = `n-${idx}`;
    nodes.push({
      id,
      label: entity.value,
      type: entity.type,
      color: getEntityColor(entity.type),
    });

    const strength: GraphEdge['strength'] =
      entity.confidence >= 85 ? 'strong' : entity.confidence >= 72 ? 'medium' : 'weak';
    edges.push({
      source: 'target',
      target: id,
      relation: entity.type.toUpperCase(),
      strength,
    });
  });

  return { nodes, edges };
};

const buildVisualReport = (
  caseDoc: any,
  entities: ExtractedEntity[],
  riskLevel: RiskLevel,
  confidenceScore: number,
  findingsCount: number
): VisualReportPayload => {
  const entitiesByType: Record<string, string[]> = {};
  entities.forEach((entity) => {
    if (!entitiesByType[entity.type]) entitiesByType[entity.type] = [];
    entitiesByType[entity.type].push(entity.value);
  });

  const tags = [
    caseDoc.category,
    caseDoc.priority,
    caseDoc.status,
    `Findings:${findingsCount}`,
    ...Object.entries(entitiesByType).map(([type, vals]) => `${type}:${vals.length}`),
  ].filter(Boolean) as string[];

  const highlightedFindings = [
    ...Object.entries(entitiesByType).slice(0, 6).map(
      ([type, vals]) => `${vals.length} ${type}${vals.length > 1 ? 's' : ''} linked to this case`
    ),
    ...(caseDoc.clues || []).slice(0, 3).map((clue: string) => `Clue: ${clue}`),
  ].slice(0, 8);

  const graph = buildGraph(caseDoc.title || 'Target', entities);

  return {
    target: caseDoc.title || 'Target',
    summary: `${findingsCount} intelligence artifacts processed across ${Object.keys(entitiesByType).length} entity classes.`,
    riskLevel,
    confidenceScore,
    tags,
    entitiesByType,
    highlightedFindings,
    relationshipGraph: graph,
  };
};

const buildFallbackMarkdown = (
  caseDoc: any,
  template: ReportTemplate,
  findingsCount: number,
  riskLevel: RiskLevel,
  visual: VisualReportPayload
) => {
  const sectionTitle = template === 'fbi' ? 'Executive Summary' : 'Overview';
  const entityLines = Object.entries(visual.entitiesByType)
    .map(([type, values]) => `- **${type.toUpperCase()}**: ${values.slice(0, 8).join(', ')}`)
    .join('\n');

  const relationLines = visual.relationshipGraph.edges
    .slice(0, 12)
    .map((edge) => {
      const source = visual.relationshipGraph.nodes.find((n) => n.id === edge.source)?.label || edge.source;
      const target = visual.relationshipGraph.nodes.find((n) => n.id === edge.target)?.label || edge.target;
      return `- ${source} → ${target} (${edge.relation}, ${edge.strength})`;
    })
    .join('\n');

  return `# ${template === 'fbi' ? 'Law Enforcement' : 'Corporate'} Intelligence Report

## ${sectionTitle}
Case **${caseDoc.title}** was analyzed with ${findingsCount} findings. Overall risk level is **${riskLevel}** with confidence score **${visual.confidenceScore}/100**.

## Structured Entity Map
${entityLines || '- No entities extracted'}

## Relationship Highlights
${relationLines || '- No relationships detected'}

## Key Findings
${visual.highlightedFindings.map((item) => `- ${item}`).join('\n') || '- None'}

## Recommendations
- Validate all extracted identifiers and map them to confirmed sources.
- Preserve a timeline for each discovered account, domain, and contact handle.
- Review recurring usernames, phone numbers, and emails for cross-platform linkage.
`;
};

const pdfColors = {
  text: rgb(0.09, 0.12, 0.18),
  muted: rgb(0.39, 0.45, 0.55),
  border: rgb(0.88, 0.91, 0.95),
  panel: rgb(0.97, 0.98, 0.99),
  accent: rgb(0.06, 0.65, 0.91),
  accentSoft: rgb(0.91, 0.97, 1),
  white: rgb(1, 1, 1),
};

const sanitizePdfText = (text: string) =>
  String(text || '')
    .replace(/→/g, '->')
    .replace(/•/g, '-')
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");

type PdfWriter = {
  pdfDoc: PDFDocument;
  page: any;
  pageWidth: number;
  pageHeight: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  y: number;
  font: PDFFont;
  boldFont: PDFFont;
  smallFont: PDFFont;
};

const createPdfWriter = async () => {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const smallFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.addPage([612, 792]);
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();

  return {
    pdfDoc,
    page,
    pageWidth,
    pageHeight,
    left: 42,
    right: 42,
    top: 44,
    bottom: 42,
    y: pageHeight - 44,
    font,
    boldFont,
    smallFont,
  } satisfies PdfWriter;
};

const ensureSpace = (writer: PdfWriter, requiredHeight: number) => {
  if (writer.y - requiredHeight < writer.bottom) {
    writer.page = writer.pdfDoc.addPage([612, 792]);
    writer.pageWidth = writer.page.getWidth();
    writer.pageHeight = writer.page.getHeight();
    writer.y = writer.pageHeight - writer.top;
  }
};

const drawWrappedText = (
  writer: PdfWriter,
  text: string,
  options: { x: number; width: number; fontSize?: number; font?: PDFFont; color?: any; lineGap?: number }
) => {
  const font = options.font || writer.font;
  const fontSize = options.fontSize || 11;
  const color = options.color || pdfColors.text;
  const lineGap = options.lineGap || 4;
  const words = sanitizePdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const lineWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (lineWidth > options.width && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) lines.push(currentLine);

  const totalHeight = lines.length * (fontSize + lineGap);
  ensureSpace(writer, totalHeight + 6);

  for (const line of lines) {
    writer.page.drawText(sanitizePdfText(line), {
      x: options.x,
      y: writer.y,
      size: fontSize,
      font,
      color,
    });
    writer.y -= fontSize + lineGap;
  }

  return totalHeight;
};

const drawLabelValue = (
  writer: PdfWriter,
  label: string,
  value: string,
  width: number,
  options?: { accentColor?: any }
) => {
  const labelWidth = 110;
  const accentColor = options?.accentColor || pdfColors.accent;
  ensureSpace(writer, 28);

  writer.page.drawText(sanitizePdfText(label.toUpperCase()), {
    x: writer.left,
    y: writer.y,
    size: 8.5,
    font: writer.boldFont,
    color: accentColor,
  });

  drawWrappedText(writer, value || '-', {
    x: writer.left + labelWidth,
    width: width - labelWidth,
    fontSize: 11,
    font: writer.font,
    color: pdfColors.text,
    lineGap: 3,
  });
};

const drawSectionTitle = (writer: PdfWriter, title: string) => {
  ensureSpace(writer, 28);
  writer.page.drawRectangle({
    x: writer.left,
    y: writer.y - 16,
    width: writer.pageWidth - writer.left - writer.right,
    height: 20,
    color: pdfColors.accentSoft,
    borderColor: pdfColors.border,
    borderWidth: 1,
  });
  writer.page.drawText(sanitizePdfText(title.toUpperCase()), {
    x: writer.left + 10,
    y: writer.y - 2,
    size: 9.5,
    font: writer.boldFont,
    color: pdfColors.accent,
  });
  writer.y -= 28;
};

const drawPill = (writer: PdfWriter, text: string, x: number, y: number, color = pdfColors.accent) => {
  const paddingX = 8;
  const safeText = sanitizePdfText(text);
  const pillWidth = writer.boldFont.widthOfTextAtSize(safeText, 9) + paddingX * 2;
  writer.page.drawRectangle({
    x,
    y: y - 2,
    width: pillWidth,
    height: 16,
    color,
    opacity: 0.12,
    borderColor: color,
    borderWidth: 1,
  });
  writer.page.drawText(safeText, {
    x: x + paddingX,
    y,
    size: 9,
    font: writer.boldFont,
    color,
  });
  return pillWidth;
};

const getMarkdownSections = (content: string) => {
  const lines = content.split('\n');
  const sections: { heading: string; body: string[] }[] = [];
  let current: { heading: string; body: string[] } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const headingMatch = line.match(/^#{1,3}\s+(.*)$/);
    if (headingMatch) {
      current = { heading: headingMatch[1].trim(), body: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      current = { heading: 'Overview', body: [] };
      sections.push(current);
    }
    current.body.push(line);
  }

  return sections.slice(0, 8);
};

const parseBulletList = (lines: string[]) =>
  lines
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 8);

// Generate AI Report
export const generateReport = async (req: AuthRequest, res: Response) => {
  try {
    const { caseId, template = 'corporate' } = req.body as { caseId?: string; template?: ReportTemplate };
    const userId = req.user?.id;

    if (!caseId || !template) {
      return res.status(400).json({ message: 'caseId and template are required' });
    }

    if (!['fbi', 'corporate'].includes(template)) {
      return res.status(400).json({ message: 'template must be "fbi" or "corporate"' });
    }

    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return res.status(404).json({ message: 'Case not found' });
    }

    // The raw findings text is stored in the case description (set from rawFindings on NewCase submit)
    const rawFindings: string = [
      caseDoc.get('description') || '',
      (caseDoc.get('clues') as string[] || []).join('\n'),
      caseDoc.get('notes') || '',
    ].filter(Boolean).join('\n').trim();

    if (!rawFindings) {
      return res.status(400).json({ message: 'No intelligence data found for this case. Please add raw findings first.' });
    }

    const targetProfile = caseDoc.get('targetProfile') || {};

    console.log(`[Report] Calling Gemini for case: ${caseDoc.get('title')}, findings length: ${rawFindings.length}`);

    // Call Gemini with raw findings
    const { markdownContent, visualReport } = await generateFullReport(
      caseDoc.get('title') as string,
      rawFindings,
      targetProfile
    );

    const syntheticDataUsed = !(await Finding.countDocuments({ caseId }));

    // Determine final risk level
    const riskMatch = markdownContent.match(/risk[^a-z]*(low|medium|high|critical)/i);
    const finalRiskLevel = normalizeRiskLevel(visualReport.riskLevel || riskMatch?.[1] || 'Medium');

    // Build flat entities list for backward compat
    const entityTypes = ['email', 'phone', 'username', 'domain', 'person', 'organization', 'ip', 'location'] as const;
    const entities: any[] = [];
    if (visualReport.entitiesByType) {
      for (const [groupKey, values] of Object.entries(visualReport.entitiesByType)) {
        const lk = groupKey.toLowerCase();
        let eType: typeof entityTypes[number] = 'username';
        if (lk.includes('email')) eType = 'email';
        else if (lk.includes('phone') || lk.includes('number')) eType = 'phone';
        else if (lk.includes('domain')) eType = 'domain';
        else if (lk.includes('ip') || lk.includes('address')) eType = 'ip';
        else if (lk.includes('location') || lk.includes('city')) eType = 'location';
        else if (lk.includes('name') || lk.includes('alias') || lk.includes('associate')) eType = 'person';
        else if (lk.includes('org') || lk.includes('company') || lk.includes('employer')) eType = 'organization';
        (values as string[]).forEach(v => entities.push({ type: eType, value: v, confidence: visualReport.confidenceScore || 75 }));
      }
    }

    const summary = markdownContent.replace(/#+.*\n/g, '').split('\n').filter(Boolean).slice(0, 3).join(' ').slice(0, 240);

    // Save report
    const report = new Report({
      caseId,
      template,
      title: `${template === 'fbi' ? 'Law Enforcement' : 'Corporate'} Intelligence Report — ${caseDoc.get('title')}`,
      content: markdownContent,
      summary,
      generatedBy: userId,
      entities,
      riskLevel: finalRiskLevel,
      findings_count: (visualReport.relationshipGraph?.nodes?.length || 1) - 1,
      visualReport,
      syntheticDataUsed,
    });

    await report.save();

    await Case.findByIdAndUpdate(caseId, {
      reportGenerated: true,
      reportTemplate: template,
      lastReportId: report._id,
    });

    await logUserActivity(req as any, 'intelligence_report_generated', `Generated ${template} report for case: ${caseDoc.get('title')}`, caseId);

    return res.status(201).json({
      success: true,
      report: {
        id: report._id,
        caseId,
        template,
        title: report.title,
        content: markdownContent,
        summary,
        entities,
        riskLevel: finalRiskLevel,
        findings_count: report.findings_count,
        generatedAt: report.generatedAt,
        visualReport,
        syntheticDataUsed,
      },
    });
  } catch (error: any) {
    console.error('Report generation error:', error);
    return res.status(500).json({
      message: 'Error generating report',
      error: error.message,
    });
  }
};

// Get Report
export const getReport = async (req: AuthRequest, res: Response) => {
  try {
    const { reportId } = req.params;

    const report = await Report.findById(reportId).populate('caseId', 'title description');
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    return res.status(200).json({
      success: true,
      report,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: 'Error fetching report',
      error: error.message,
    });
  }
};

// Get Case Reports (includes visualReport from DB)
export const getCaseReports = async (req: AuthRequest, res: Response) => {
  try {
    const { caseId } = req.params;

    const reports = await Report.find({ caseId }).sort({ createdAt: -1 }).limit(10).lean();

    const serialized = reports.map((r: any) => ({
      id: r._id,
      caseId: r.caseId,
      template: r.template,
      title: r.title,
      content: r.content,
      summary: r.summary,
      entities: r.entities,
      riskLevel: r.riskLevel,
      findings_count: r.findings_count,
      generatedAt: r.generatedAt || r.createdAt,
      visualReport: r.visualReport || null,
      syntheticDataUsed: r.syntheticDataUsed || false,
    }));

    return res.status(200).json({
      success: true,
      reports: serialized,
    });
  } catch (error: any) {
    return res.status(500).json({
      message: 'Error fetching reports',
      error: error.message,
    });
  }
};

// Export Report to PDF
export const exportReportPDF = async (req: AuthRequest, res: Response) => {
  try {
    const { reportId } = req.params;

    const report = await Report.findById(reportId).populate('caseId', 'title description category priority status clues targetProfile');
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    const writer = await createPdfWriter();
    const caseDoc = report.caseId as any;
    const caseTitle = caseDoc?.title || report.title;
    const caseDescription = caseDoc?.description || '';
    const clues = Array.isArray(caseDoc?.clues) ? caseDoc.clues : [];
    const targetProfile = caseDoc?.targetProfile || {};
    const entityGroups = report.entities.reduce((acc: Record<string, string[]>, entity) => {
      if (!acc[entity.type]) acc[entity.type] = [];
      if (!acc[entity.type].includes(entity.value)) acc[entity.type].push(entity.value);
      return acc;
    }, {});
    const markdownSections = getMarkdownSections(report.content);
    const bullets = parseBulletList(report.content.split('\n'));

    // Header
    writer.page.drawRectangle({
      x: 0,
      y: writer.pageHeight - 110,
      width: writer.pageWidth,
      height: 110,
      color: pdfColors.white,
      borderColor: pdfColors.border,
      borderWidth: 1,
    });
    writer.page.drawText(sanitizePdfText('CASE DOSSIER'), {
      x: writer.left,
      y: writer.pageHeight - 36,
      size: 10,
      font: writer.boldFont,
      color: pdfColors.accent,
    });
    writer.page.drawText(sanitizePdfText(caseTitle), {
      x: writer.left,
      y: writer.pageHeight - 58,
      size: 20,
      font: writer.boldFont,
      color: pdfColors.text,
    });
    drawWrappedText(writer, report.summary || 'Structured intelligence report generated from case findings.', {
      x: writer.left,
      width: writer.pageWidth - writer.left - writer.right - 150,
      fontSize: 10.5,
      font: writer.font,
      color: pdfColors.muted,
      lineGap: 3,
    });

    const riskColor = report.riskLevel === 'Critical'
      ? rgb(0.83, 0.15, 0.15)
      : report.riskLevel === 'High'
        ? rgb(0.92, 0.38, 0.1)
        : report.riskLevel === 'Medium'
          ? rgb(0.79, 0.62, 0.0)
          : rgb(0.09, 0.64, 0.28);
    drawPill(writer, `${report.riskLevel.toUpperCase()} RISK`, writer.pageWidth - 180, writer.pageHeight - 48, riskColor);

    writer.y = writer.pageHeight - 128;

    // Meta chips
    const metaText = [
      `Template: ${report.template.toUpperCase()}`,
      `Findings: ${report.findings_count}`,
      `Generated: ${new Date(report.generatedAt).toLocaleString()}`,
    ];
    let chipX = writer.left;
    for (const item of metaText) {
      const width = drawPill(writer, item, chipX, writer.y, pdfColors.accent);
      chipX += width + 10;
    }
    writer.y -= 28;

    // Executive summary panel
    writer.page.drawRectangle({
      x: writer.left,
      y: writer.y - 82,
      width: writer.pageWidth - writer.left - writer.right,
      height: 82,
      color: pdfColors.panel,
      borderColor: pdfColors.border,
      borderWidth: 1,
    });
    writer.page.drawText(sanitizePdfText('Executive Summary'), {
      x: writer.left + 12,
      y: writer.y - 24,
      size: 12,
      font: writer.boldFont,
      color: pdfColors.text,
    });
    drawWrappedText(writer, report.summary || 'No summary available.', {
      x: writer.left + 12,
      width: writer.pageWidth - writer.left - writer.right - 24,
      fontSize: 10.5,
      font: writer.font,
      color: pdfColors.muted,
      lineGap: 3,
    });
    writer.y -= 96;

    // Key stats
    drawSectionTitle(writer, 'Overview');
    const statWidth = (writer.pageWidth - writer.left - writer.right - 18) / 3;
    const statHeight = 54;
    const statY = writer.y - statHeight;
    const stats = [
      { label: 'Risk Level', value: report.riskLevel },
      { label: 'Findings', value: String(report.findings_count) },
      { label: 'Entities', value: String(report.entities.length) },
    ];
    stats.forEach((stat, index) => {
      const x = writer.left + index * (statWidth + 9);
      writer.page.drawRectangle({
        x,
        y: statY,
        width: statWidth,
        height: statHeight,
        color: pdfColors.white,
        borderColor: pdfColors.border,
        borderWidth: 1,
      });
      writer.page.drawText(sanitizePdfText(stat.label.toUpperCase()), {
        x: x + 10,
        y: statY + 34,
        size: 8,
        font: writer.boldFont,
        color: pdfColors.muted,
      });
      writer.page.drawText(sanitizePdfText(stat.value), {
        x: x + 10,
        y: statY + 16,
        size: 16,
        font: writer.boldFont,
        color: pdfColors.text,
      });
    });
    writer.y = statY - 18;

    // Identity and profile block
    drawSectionTitle(writer, 'Identity Summary');
    drawLabelValue(writer, 'Target', caseTitle, writer.pageWidth - writer.left - writer.right);
    if (targetProfile?.name) drawLabelValue(writer, 'Name', String(targetProfile.name), writer.pageWidth - writer.left - writer.right);
    if (targetProfile?.email) drawLabelValue(writer, 'Email', String(targetProfile.email), writer.pageWidth - writer.left - writer.right);
    if (targetProfile?.phone) drawLabelValue(writer, 'Phone', String(targetProfile.phone), writer.pageWidth - writer.left - writer.right);
    if (targetProfile?.organization) drawLabelValue(writer, 'Organization', String(targetProfile.organization), writer.pageWidth - writer.left - writer.right);
    if (targetProfile?.location) drawLabelValue(writer, 'Location', String(targetProfile.location), writer.pageWidth - writer.left - writer.right);
    if (targetProfile?.socialMedia) drawLabelValue(writer, 'Social', String(targetProfile.socialMedia), writer.pageWidth - writer.left - writer.right);

    if (caseDescription) {
      writer.y -= 8;
      drawLabelValue(writer, 'Case Notes', caseDescription, writer.pageWidth - writer.left - writer.right);
    }

    if (clues.length) {
      writer.y -= 4;
      drawSectionTitle(writer, 'Known Clues');
      for (const clue of clues.slice(0, 5)) {
        drawWrappedText(writer, `• ${clue}`, {
          x: writer.left + 4,
          width: writer.pageWidth - writer.left - writer.right - 8,
          fontSize: 10.5,
          font: writer.font,
          color: pdfColors.text,
          lineGap: 3,
        });
      }
    }

    // Entity grid
    drawSectionTitle(writer, 'Entity Groups');
    const groupedEntries = Object.entries(entityGroups);
    if (groupedEntries.length === 0) {
      drawWrappedText(writer, 'No structured entities were extracted for this report.', {
        x: writer.left + 4,
        width: writer.pageWidth - writer.left - writer.right - 8,
        fontSize: 10.5,
        font: writer.font,
        color: pdfColors.muted,
        lineGap: 3,
      });
    } else {
      for (const [type, values] of groupedEntries.slice(0, 6)) {
        ensureSpace(writer, 54);
        writer.page.drawRectangle({
          x: writer.left,
          y: writer.y - 46,
          width: writer.pageWidth - writer.left - writer.right,
          height: 46,
          color: pdfColors.white,
          borderColor: pdfColors.border,
          borderWidth: 1,
        });
        writer.page.drawText(sanitizePdfText(type.toUpperCase()), {
          x: writer.left + 10,
          y: writer.y - 16,
          size: 9,
          font: writer.boldFont,
          color: pdfColors.accent,
        });
        drawWrappedText(writer, values.slice(0, 8).join(', '), {
          x: writer.left + 10,
          width: writer.pageWidth - writer.left - writer.right - 20,
          fontSize: 10.5,
          font: writer.font,
          color: pdfColors.text,
          lineGap: 3,
        });
        writer.y -= 56;
      }
    }

    // Highlights
    drawSectionTitle(writer, 'Highlights');
    const highlightSource = markdownSections.find((section) => /findings|highlights|summary/i.test(section.heading));
    const highlightLines = highlightSource ? parseBulletList(highlightSource.body) : bullets.slice(0, 5);
    if (highlightLines.length === 0) {
      drawWrappedText(writer, 'No highlights were available in the report content.', {
        x: writer.left + 4,
        width: writer.pageWidth - writer.left - writer.right - 8,
        fontSize: 10.5,
        font: writer.font,
        color: pdfColors.muted,
        lineGap: 3,
      });
    } else {
      for (const item of highlightLines) {
        drawWrappedText(writer, `• ${item}`, {
          x: writer.left + 4,
          width: writer.pageWidth - writer.left - writer.right - 8,
          fontSize: 10.5,
          font: writer.font,
          color: pdfColors.text,
          lineGap: 3,
        });
      }
    }

    // Narrative sections from markdown
    const narrativeSections = markdownSections.filter((section) => !/findings|highlights/i.test(section.heading)).slice(0, 4);
    for (const section of narrativeSections) {
      drawSectionTitle(writer, section.heading);
      const sectionBody = parseBulletList(section.body);
      if (sectionBody.length === 0) {
        drawWrappedText(writer, section.body.join(' '), {
          x: writer.left + 4,
          width: writer.pageWidth - writer.left - writer.right - 8,
          fontSize: 10.5,
          font: writer.font,
          color: pdfColors.text,
          lineGap: 3,
        });
      } else {
        for (const item of sectionBody) {
          drawWrappedText(writer, `• ${item}`, {
            x: writer.left + 4,
            width: writer.pageWidth - writer.left - writer.right - 8,
            fontSize: 10.5,
            font: writer.font,
            color: pdfColors.text,
            lineGap: 3,
          });
        }
      }
    }

    // Footer on the final page
    writer.page.drawText(sanitizePdfText(`Generated by Shadow Scan • ${new Date(report.generatedAt).toLocaleString()}`), {
      x: writer.left,
      y: 28,
      size: 8.5,
      font: writer.smallFont,
      color: pdfColors.muted,
    });

    const pdfBytes = await writer.pdfDoc.save();

    res.contentType('application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${report._id}.pdf"`);
    return res.send(Buffer.from(pdfBytes));
  } catch (error: any) {
    console.error('PDF export error:', error);
    return res.status(500).json({
      message: 'Error exporting report',
      error: error.message,
    });
  }
};

// Export Report to JSON
export const exportReportJSON = async (req: AuthRequest, res: Response) => {
  try {
    const { reportId } = req.params;

    const report = await Report.findById(reportId).populate('caseId');
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    res.contentType('application/json');
    res.setHeader('Content-Disposition', `attachment; filename="report-${report._id}.json"`);
    return res.json(report);
  } catch (error: any) {
    return res.status(500).json({
      message: 'Error exporting report',
      error: error.message,
    });
  }
};
