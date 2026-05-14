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

// Generate AI Report
export const generateReport = async (req: AuthRequest, res: Response) => {
  try {
    const { caseId, template = 'corporate' } = req.body;
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

    const findings = await Finding.find({ caseId });
    if (findings.length === 0) {
      return res.status(400).json({ message: 'No findings available for this case' });
    }

    // Format findings for AI
    const formattedFindings = formatFindingsForAI(findings);

    // Create AI prompt based on template
    let systemPrompt = `You are a cybersecurity intelligence analyst specializing in OSINT investigations.`;
    let userPrompt = '';

    if (template === 'fbi') {
      systemPrompt += ` Generate a professional FBI-style intelligence report.`;
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

Format the report in clear, professional language suitable for law enforcement documentation.`;
    } else {
      systemPrompt += ` Generate a professional corporate intelligence report.`;
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
6. **Exposure Timeline** - When data/entities were discovered
7. **Business Impact** - Potential implications
8. **Remediation Steps** - Recommended actions
9. **References** - Data sources (APIs and discovery methods)

Format in professional business language suitable for executive briefing.`;
    }

    // Call Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
    const reportContent = result.response.text() || '';

    // Extract key entities and risk level from report
    const entities: any[] = findings
      .flatMap((f) => {
        const ents = [];
        if (f.email) ents.push({ type: 'email', value: f.email, confidence: f.confidence });
        if (f.username) ents.push({ type: 'username', value: f.username, confidence: f.confidence });
        if (f.phone) ents.push({ type: 'phone', value: f.phone, confidence: f.confidence });
        if (f.domain) ents.push({ type: 'domain', value: f.domain, confidence: f.confidence });
        return ents;
      })
      .filter((v, i, a) => a.findIndex((t) => t.value === v.value) === i); // Deduplicate

    const riskMatch = reportContent.match(/risk.*?(low|medium|high|critical)/i);
    const riskLevel = riskMatch ? (riskMatch[1].toLowerCase() as 'Low' | 'Medium' | 'High' | 'Critical') : 'Medium';

    const summary = reportContent.split('\n').slice(0, 3).join('\n').slice(0, 200);

    // Save report to database
    const report = new Report({
      caseId,
      template,
      title: `${template === 'fbi' ? 'Law Enforcement' : 'Corporate'} Intelligence Report - ${caseDoc.title}`,
      content: reportContent,
      summary,
      generatedBy: userId,
      entities,
      riskLevel: riskLevel as any,
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
    await logUserActivity(req as any, 'email_lookup', `Generated ${template} report for case: ${caseDoc.title}`, caseId);

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
        riskLevel,
        findings_count: findings.length,
        generatedAt: report.generatedAt,
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
