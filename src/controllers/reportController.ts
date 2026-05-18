import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PDFDocument, rgb } from 'pdf-lib';
import Case from '../models/Case';
import Report from '../models/Report';
import Finding from '../models/Finding';
import { logUserActivity } from '../utils/logActivity';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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

    // Fetch case and findings
    const caseDoc = await Case.findById(caseId).populate('findings');
    if (!caseDoc) {
      return res.status(404).json({ message: 'Case not found' });
    }

    let findings = await Finding.find({ caseId }).lean();
    let syntheticDataUsed = false;

    if (findings.length === 0) {
      findings = buildSyntheticFindingsFromCase(caseDoc);
      syntheticDataUsed = true;
    }
    if (findings.length === 0) {
      return res.status(400).json({ message: 'No analyzable intelligence found for this case' });
    }

    // Format findings for AI
    const formattedFindings = formatFindingsForAI(findings);
    const extractedEntities = extractEntitiesFromFindings(findings);
    const avgConfidence = Math.round(
      findings.reduce((sum, finding) => sum + (finding.confidence || 70), 0) / findings.length
    );
    const confidenceScore = Math.max(20, Math.min(100, avgConfidence));
    const riskLevel = confidenceToRisk(confidenceScore);
    const visualReport = buildVisualReport(caseDoc, extractedEntities, riskLevel, confidenceScore, findings.length);

    // Create AI prompt based on template
    let systemPrompt = `You are a cybersecurity intelligence analyst specializing in OSINT investigations.`;
    let userPrompt = '';

    if (template === 'fbi') {
      systemPrompt += ` Generate a professional FBI-style intelligence report with concise, structured sections and relationship-focused analysis.`;
      userPrompt = `Convert the following OSINT investigation findings into a formal law enforcement intelligence report.

**Case Title**: ${caseDoc.title}
**Case Description**: ${caseDoc.description}

**Investigation Findings**:
${formattedFindings}

**Report Structure Required**:
1. **Executive Summary** - 2-3 sentence overview
2. **Subject Identification** - All identified entities (emails, usernames, phone numbers, domains)
3. **Investigation Timeline** - Chronological discovery sequence
4. **Relationships & Connections** - Identified correlations between entities
5. **Risk Assessment** - Overall risk level (Low/Medium/High/Critical)
6. **Recommendations** - Next investigative steps
7. **Sources** - List all API sources used
8. **Relationship Matrix** - Table with Source Entity, Related Entity, Relationship Type, Confidence

Format requirements:
- Use Markdown headings and short bullet points.
- Include at least one table for relationship mapping.
- Add color semantics using labels like [CRITICAL], [HIGH], [MEDIUM], [LOW] where relevant.
- Keep tone suitable for law enforcement briefing.`;
    } else {
      systemPrompt += ` Generate a professional corporate intelligence report with readable headings, visual-style structure, and clear bullet points.`;
      userPrompt = `Convert the following OSINT investigation findings into a corporate intelligence report.

**Case Title**: ${caseDoc.title}
**Case Description**: ${caseDoc.description}

**Investigation Findings**:
${formattedFindings}

**Report Structure Required**:
1. **Overview** - Brief summary of investigation
2. **Key Findings** - Primary discoveries with confidence levels
3. **Entity Summary** - All identified entities and their significance
4. **Data Exposure Assessment** - What personal/corporate data was exposed
5. **Risk Level** - Overall risk rating (Low/Medium/High/Critical)
6. **Discovery Timeline** - When data/entities were discovered
7. **Business Impact** - Potential implications
8. **Remediation Steps** - Recommended actions
9. **References** - Data sources (APIs and discovery methods)
10. **Relationship Matrix** - Table with Entity A, Entity B, Relationship, Confidence

Format requirements:
- Use Markdown headings and concise bullets.
- Include at least one table for relationships.
- Use labeled risk tags like [CRITICAL], [HIGH], [MEDIUM], [LOW].
- Keep tone suitable for executive briefings.`;
    }

    // Call Gemini
    let reportContent = buildFallbackMarkdown(caseDoc, template, findings.length, riskLevel, visualReport);
    if (process.env.GEMINI_API_KEY) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
        const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
        const aiText = result.response.text() || '';
        if (aiText.trim().length > 80) reportContent = aiText;
      } catch (aiError: any) {
        console.error('Gemini generation failed, using fallback report:', aiError?.message || aiError);
      }
    }

    // Extract key entities and risk level from report content
    const entities: any[] = extractedEntities
      .filter((entity) => ['email', 'username', 'phone', 'domain', 'person', 'organization'].includes(entity.type))
      .map((entity) => ({
        type: entity.type === 'person' ? 'person' : entity.type === 'organization' ? 'organization' : entity.type,
        value: entity.value,
        confidence: entity.confidence,
      }));

    const riskMatch = reportContent.match(/risk[^a-z]*(low|medium|high|critical)/i);
    const contentRisk = normalizeRiskLevel(riskMatch?.[1]);
    const finalRiskLevel = contentRisk || riskLevel;
    const summary = reportContent.split('\n').slice(0, 3).join('\n').slice(0, 240);

    // Save report to database
    const report = new Report({
      caseId,
      template,
      title: `${template === 'fbi' ? 'Law Enforcement' : 'Corporate'} Intelligence Report - ${caseDoc.title}`,
      content: reportContent,
      summary,
      generatedBy: userId,
      entities,
      riskLevel: finalRiskLevel as any,
      findings_count: findings.length,
    });

    await report.save();

    // Update case with report reference
    await Case.findByIdAndUpdate(caseId, {
      reportGenerated: true,
      reportTemplate: template,
      lastReportId: report._id,
    });

    // Log activity
    await logUserActivity(req as any, 'intelligence_report_generated', `Generated ${template} report for case: ${caseDoc.title}`, caseId);

    return res.status(201).json({
      success: true,
      report: {
        id: report._id,
        caseId,
        template,
        title: report.title,
        content: reportContent,
        summary,
        entities,
        riskLevel: finalRiskLevel,
        findings_count: findings.length,
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

// Get Case Reports
export const getCaseReports = async (req: AuthRequest, res: Response) => {
  try {
    const { caseId } = req.params;

    const reports = await Report.find({ caseId }).sort({ createdAt: -1 }).limit(10);

    return res.status(200).json({
      success: true,
      reports,
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

    const report = await Report.findById(reportId).populate('caseId', 'title description');
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([612, 792]); // Letter size
    const { height } = page.getSize();
    let yPosition = height - 50;

    const drawText = (text: string, fontSize: number = 12, isBold: boolean = false) => {
      if (yPosition < 50) {
        page = pdfDoc.addPage([612, 792]);
        yPosition = height - 50;
      }
      page.drawText(text, {
        x: 50,
        y: yPosition,
        size: fontSize,
        color: rgb(0, 0, 0),
      });
      yPosition -= fontSize + 8;
    };

    drawText(report.title, 16, true);
    drawText(`Template: ${report.template.toUpperCase()}`, 11);
    drawText(`Risk Level: ${report.riskLevel}`, 11);
    drawText(`Generated: ${new Date(report.generatedAt).toLocaleDateString()}`, 10);
    drawText('', 10);

    // Split content into lines
    const lines = report.content.split('\n');
    for (const line of lines) {
      drawText(line, 10);
    }

    const pdfBytes = await pdfDoc.save();

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
