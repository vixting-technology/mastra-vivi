import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { extractTextFromPDF } from '../lib/util';

const DocumentAnalysisResult = z.object({
  completenessScore: z.number().min(0).max(100).describe('Score de completude da documentacao (0-100)'),
  hasRequiredDocuments: z.boolean().describe('Se possui documentos obrigatorios'),
  missingDocuments: z.array(z.string()).describe('Lista de documentos faltantes'),
  documentQuality: z
    .enum(['EXCELENTE', 'BOA', 'REGULAR', 'INSUFICIENTE'])
    .describe('Qualidade geral dos documentos'),

  extractedContent: z.object({
    rawText: z.string().describe('Texto extraido do PDF'),
    pagesCount: z.number().describe('Numero de paginas do documento'),
    characterCount: z.number().describe('Numero de caracteres extraidos'),
  }),

  medicalDocuments: z.object({
    hasCurrentMedicalReport: z.boolean(),
    hasSpecialistReport: z.boolean(),
    hasComplementaryExams: z.boolean(),
    hasCIDDiagnosis: z.boolean(),
    documentAgeInDays: z.number().optional(),
    issuerQualifications: z.array(z.string()),
  }),

  legalCompliance: z.object({
    meetsLei13146Requirements: z.boolean(),
    meetsCIFCriteria: z.boolean(),
    hasProperMedicalSignature: z.boolean(),
    hasValidCRM: z.boolean(),
  }),

  detectedDeficiencyType: z
    .enum(['FISICA', 'INTELECTUAL', 'AUDITIVA', 'VISUAL', 'MULTIPLA', 'PSICOSSOCIAL', 'NAO_IDENTIFICADA'])
    .describe('Tipo de deficiencia detectada no documento'),

  recommendations: z.array(z.string()).describe('Recomendacoes para melhoria da documentacao'),
  urgencyFlags: z.array(z.string()).describe('Sinalizadores que requerem atencao urgente'),
});

export const analyzePCDDocumentFromPDF = createTool({
  id: 'analyze-pcd-document-from-pdf',
  description: `Analisa documentos medicos em formato PDF para processo de PCD (Pessoa com Deficiencia).
  Extrai texto do PDF usando pdf2json, avalia completude e qualidade da documentacao,
  e fornece recomendacoes para casos onde faltam elementos para analise conclusiva.
  Segue criterios da Lei 13.146/2015 e CIF.`,

  inputSchema: z.object({
    pdfUrl: z.string().url().describe('URL do documento PDF para analise'),
    candidateName: z.string().describe('Nome do candidato'),
    candidateCpf: z.string().describe('CPF do candidato'),
    expectedDeficiencyType: z
      .enum(['FISICA', 'INTELECTUAL', 'AUDITIVA', 'VISUAL', 'MULTIPLA', 'PSICOSSOCIAL', 'DESCONHECIDA'])
      .optional()
      .describe('Tipo de deficiencia esperada, se conhecida'),
  }),

  outputSchema: DocumentAnalysisResult,

  execute: async ({ context }) => {
    const { pdfUrl, candidateName, candidateCpf, expectedDeficiencyType } = context;

    console.log(`📋 Analisando documento PDF de ${candidateName} (CPF: ${candidateCpf})`);
    console.log(`📥 Baixando PDF de: ${pdfUrl}`);

    try {
      // Step 1: Download the PDF
      const response = await fetch(pdfUrl);

      if (!response.ok) {
        throw new Error(`Falha ao baixar PDF: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);

      console.log(`✅ PDF baixado: ${pdfBuffer.length} bytes`);

      // Step 2: Extract text from PDF using mastra-vivi pattern
      console.log('📄 Extraindo texto do PDF...');
      const extractionResult = await extractTextFromPDF(pdfBuffer);

      if (!extractionResult.extractedText || extractionResult.extractedText.trim() === '') {
        throw new Error('Nenhum texto pode ser extraido do PDF');
      }

      const content = extractionResult.extractedText.toLowerCase();
      console.log(
        `✅ Extraidos ${extractionResult.extractedText.length} caracteres de ${extractionResult.pagesCount} paginas`,
      );

      // Step 3: Analyze document content for PCD criteria
      const missingDocuments: string[] = [];
      const recommendations: string[] = [];
      const urgencyFlags: string[] = [];
      const issuerQualifications: string[] = [];

      // Check for CID diagnosis
      const hasCIDDiagnosis = content.includes('cid') || content.includes('c.i.d') || /cid-?\d+/.test(content);

      // Check for medical signatures
      const hasValidCRM = content.includes('crm') || /crm[\s-]*\d+/.test(content);
      const hasProperMedicalSignature = hasValidCRM && (content.includes('dr.') || content.includes('dra.'));

      // Detect deficiency type from content
      let detectedDeficiencyType:
        | 'FISICA'
        | 'INTELECTUAL'
        | 'AUDITIVA'
        | 'VISUAL'
        | 'MULTIPLA'
        | 'PSICOSSOCIAL'
        | 'NAO_IDENTIFICADA' = 'NAO_IDENTIFICADA';

      if (
        content.includes('deficiência física') ||
        content.includes('deficiencia fisica') ||
        content.includes('mobilidade reduzida') ||
        content.includes('paraplegia') ||
        content.includes('amputação') ||
        content.includes('amputacao')
      ) {
        detectedDeficiencyType = 'FISICA';
        issuerQualifications.push('Ortopedia', 'Fisiatria');
      }

      if (
        content.includes('deficiência intelectual') ||
        content.includes('deficiencia intelectual') ||
        content.includes('retardo mental') ||
        content.includes('transtorno do desenvolvimento')
      ) {
        detectedDeficiencyType = 'INTELECTUAL';
        issuerQualifications.push('Neurologia', 'Psiquiatria');
      }

      if (
        content.includes('deficiência auditiva') ||
        content.includes('deficiencia auditiva') ||
        content.includes('surdez') ||
        content.includes('perda auditiva') ||
        content.includes('audiometria')
      ) {
        detectedDeficiencyType = 'AUDITIVA';
        issuerQualifications.push('Otorrinolaringologia', 'Fonoaudiologia');

        // Specific check for auditory exams
        if (!content.includes('audiometria') && !content.includes('bera')) {
          missingDocuments.push('Audiometria ou BERA (obrigatorio para deficiencia auditiva)');
        }
      }

      if (
        content.includes('deficiência visual') ||
        content.includes('deficiencia visual') ||
        content.includes('cegueira') ||
        content.includes('baixa visão') ||
        content.includes('baixa visao') ||
        content.includes('acuidade visual')
      ) {
        detectedDeficiencyType = 'VISUAL';
        issuerQualifications.push('Oftalmologia');

        // Specific check for visual exams
        if (!content.includes('acuidade visual') && !content.includes('campo visual')) {
          missingDocuments.push('Exame de acuidade visual e campo visual (obrigatorio para deficiencia visual)');
        }
      }

      if (
        content.includes('transtorno mental') ||
        content.includes('psicossocial') ||
        content.includes('esquizofrenia') ||
        content.includes('bipolar')
      ) {
        detectedDeficiencyType = 'PSICOSSOCIAL';
        issuerQualifications.push('Psiquiatria');
      }

      // Check for multiple deficiencies
      const deficiencyKeywords = ['física', 'fisica', 'auditiva', 'visual', 'intelectual', 'psicossocial'];
      const foundDeficiencies = deficiencyKeywords.filter((kw) => content.includes(kw));
      if (foundDeficiencies.length > 1) {
        detectedDeficiencyType = 'MULTIPLA';
      }

      // Check document types present
      const hasLaudoMedico =
        content.includes('laudo médico') || content.includes('laudo medico') || content.includes('parecer médico');
      const hasSpecialistReport =
        content.includes('relatório') ||
        content.includes('relatorio') ||
        content.includes('especialista') ||
        content.includes('avaliação');
      const hasComplementaryExams =
        content.includes('exame') || content.includes('resultado') || content.includes('tomografia');

      // Check for CIF criteria
      const meetsCIFCriteria =
        content.includes('funcionalidade') ||
        content.includes('cif') ||
        content.includes('limitação funcional') ||
        content.includes('limitacao funcional');

      // Build missing documents list
      if (!hasLaudoMedico) {
        missingDocuments.push('Laudo medico atualizado (obrigatorio)');
      }
      if (!hasCIDDiagnosis) {
        missingDocuments.push('Diagnostico com codigo CID');
        urgencyFlags.push('Falta diagnostico com CID - fundamental para avaliacao');
      }
      if (!hasValidCRM) {
        missingDocuments.push('Documento com CRM do medico');
      }

      // Calculate completeness score
      let completenessScore = 0;

      // Base documents (40 points)
      if (hasLaudoMedico) completenessScore += 20;
      if (hasSpecialistReport) completenessScore += 20;

      // Medical information (30 points)
      if (hasCIDDiagnosis) completenessScore += 10;
      if (hasProperMedicalSignature) completenessScore += 10;
      if (hasValidCRM) completenessScore += 10;

      // Deficiency identification (20 points)
      if (detectedDeficiencyType !== 'NAO_IDENTIFICADA') completenessScore += 15;
      if (meetsCIFCriteria) completenessScore += 5;

      // Additional documents (10 points)
      if (hasComplementaryExams) completenessScore += 10;

      // Determine document quality
      let documentQuality: 'EXCELENTE' | 'BOA' | 'REGULAR' | 'INSUFICIENTE' = 'INSUFICIENTE';
      if (completenessScore >= 85) documentQuality = 'EXCELENTE';
      else if (completenessScore >= 70) documentQuality = 'BOA';
      else if (completenessScore >= 50) documentQuality = 'REGULAR';

      // Generate recommendations
      if (missingDocuments.length > 0) {
        recommendations.push('Solicitar documentos faltantes listados');
      }
      if (!hasValidCRM) {
        recommendations.push('Verificar assinatura e carimbo medico com CRM valido');
      }
      if (completenessScore < 70) {
        recommendations.push('Documentacao insuficiente - solicitar relatorio medico mais detalhado');
      }
      if (detectedDeficiencyType === 'NAO_IDENTIFICADA') {
        recommendations.push('Identificar tipo especifico de deficiencia nos documentos');
        urgencyFlags.push('Tipo de deficiencia nao identificado no documento');
      }

      // Check expected vs detected deficiency type
      if (expectedDeficiencyType && expectedDeficiencyType !== 'DESCONHECIDA') {
        if (detectedDeficiencyType !== expectedDeficiencyType && detectedDeficiencyType !== 'NAO_IDENTIFICADA') {
          urgencyFlags.push(
            `Tipo de deficiencia detectada (${detectedDeficiencyType}) difere do esperado (${expectedDeficiencyType})`,
          );
        }
      }

      const hasRequiredDocuments = hasLaudoMedico && hasCIDDiagnosis;

      console.log(`✅ Analise concluida - Score: ${completenessScore}/100 (${documentQuality})`);
      console.log(`📋 Documentos faltantes: ${missingDocuments.length}`);
      console.log(`🔍 Tipo de deficiencia detectada: ${detectedDeficiencyType}`);

      return {
        completenessScore,
        hasRequiredDocuments,
        missingDocuments,
        documentQuality,
        extractedContent: {
          rawText: extractionResult.extractedText,
          pagesCount: extractionResult.pagesCount,
          characterCount: extractionResult.extractedText.length,
        },
        medicalDocuments: {
          hasCurrentMedicalReport: hasLaudoMedico,
          hasSpecialistReport,
          hasComplementaryExams,
          hasCIDDiagnosis,
          issuerQualifications,
        },
        legalCompliance: {
          meetsLei13146Requirements: hasRequiredDocuments && hasCIDDiagnosis,
          meetsCIFCriteria,
          hasProperMedicalSignature,
          hasValidCRM,
        },
        detectedDeficiencyType,
        recommendations,
        urgencyFlags,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('❌ Erro na analise de documento PDF:', errorMessage);

      return {
        completenessScore: 0,
        hasRequiredDocuments: false,
        missingDocuments: [`Erro na analise: ${errorMessage}`],
        documentQuality: 'INSUFICIENTE' as const,
        extractedContent: {
          rawText: '',
          pagesCount: 0,
          characterCount: 0,
        },
        medicalDocuments: {
          hasCurrentMedicalReport: false,
          hasSpecialistReport: false,
          hasComplementaryExams: false,
          hasCIDDiagnosis: false,
          issuerQualifications: [],
        },
        legalCompliance: {
          meetsLei13146Requirements: false,
          meetsCIFCriteria: false,
          hasProperMedicalSignature: false,
          hasValidCRM: false,
        },
        detectedDeficiencyType: 'NAO_IDENTIFICADA' as const,
        recommendations: ['Erro tecnico na analise - reprocessar documentacao ou verificar URL do PDF'],
        urgencyFlags: ['Sistema indisponivel ou PDF invalido - analise manual urgente'],
      };
    }
  },
});
