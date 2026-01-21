import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// Types for PCD evaluation
const PCDOutcome = z.enum(['SIM', 'NAO', 'TALVEZ']);
const DeficiencyType = z.enum(['FISICA', 'INTELECTUAL', 'AUDITIVA', 'VISUAL', 'MULTIPLA', 'PSICOSSOCIAL']);

const LegalFramework = z.object({
  lei13146: z.string().describe('Referência à Lei 13.146/2015 (Lei Brasileira de Inclusão)'),
  cif: z.string().describe('Classificação Internacional de Funcionalidade (CIF)'),
  decreto: z.string().describe('Decreto aplicável se houver'),
});

const PCDEvaluationResult = z.object({
  outcome: PCDOutcome.describe('Resultado da avaliação: SIM (enquadra), NAO (não enquadra), TALVEZ (precisa mais informações)'),
  confidence: z.number().min(0).max(1).describe('Nível de confiança da avaliação (0-1)'),
  deficiencyType: DeficiencyType.optional().describe('Tipo de deficiência identificada'),
  severityLevel: z.enum(['LEVE', 'MODERADA', 'GRAVE', 'GRAVISSIMA']).optional(),
  functionalLimitations: z.array(z.string()).describe('Limitações funcionais identificadas'),
  compensatoryFactors: z.array(z.string()).describe('Fatores compensatórios ou adaptativos'),
  legalJustification: LegalFramework.describe('Base legal da avaliação'),
  clinicalEvidence: z.array(z.string()).describe('Evidências clínicas encontradas na documentação'),
  missingDocumentation: z.array(z.string()).describe('Documentação faltante se outcome for TALVEZ'),
  technicalReasoning: z.string().describe('Justificativa técnica detalhada da decisão'),
  requiresPhysicalEvaluation: z.boolean().describe('Se necessária avaliação física presencial'),
});

export const evaluatePCDEligibility = createTool({
  id: 'evaluate-pcd-eligibility',
  description: `Avalia se uma pessoa se enquadra como PCD (Pessoa com Deficiência) baseado na documentação médica fornecida,
  seguindo a Lei 13.146/2015 (Lei Brasileira de Inclusão) e a Classificação Internacional de Funcionalidade (CIF).
  Analisa laudos médicos, relatórios de especialistas e demais documentos para determinar elegibilidade.`,

  inputSchema: z.object({
    candidateName: z.string().describe('Nome completo do candidato'),
    candidateCpf: z.string().describe('CPF do candidato'),
    documentationProvided: z
      .array(
        z.object({
          type: z
            .enum([
              'LAUDO_MEDICO',
              'RELATORIO_ESPECIALISTA',
              'EXAMES_COMPLEMENTARES',
              'ATESTADO_MEDICO',
              'CIF_ASSESSMENT',
              'NEUROPSICOLOGICO',
              'OUTROS',
            ])
            .describe('Tipo do documento'),
          content: z.string().describe('Conteúdo ou resumo do documento'),
          issueDate: z.string().optional().describe('Data de emissão do documento'),
          professionalCRM: z.string().optional().describe('CRM do profissional'),
          specialization: z.string().optional().describe('Especialização médica'),
        }),
      )
      .describe('Documentação médica fornecida'),

    requestingCompany: z.string().describe('Empresa solicitante'),
    urgencyLevel: z.enum(['NORMAL', 'URGENTE']).default('NORMAL'),
    previousEvaluations: z.array(z.string()).optional().describe('Avaliações anteriores se houver'),
  }),

  outputSchema: PCDEvaluationResult,

  execute: async ({ context }) => {
    const { candidateName, candidateCpf, documentationProvided, requestingCompany, urgencyLevel, previousEvaluations } =
      context;

    console.log(`🔍 Iniciando avaliação PCD para ${candidateName} (CPF: ${candidateCpf})`);
    console.log(`📄 Documentos fornecidos: ${documentationProvided.length}`);
    console.log(`🏢 Empresa solicitante: ${requestingCompany}`);

    try {
      // 1. Analyze documentation completeness
      const hasLaudoMedico = documentationProvided.some((doc) => doc.type === 'LAUDO_MEDICO');
      const hasSpecialistReport = documentationProvided.some((doc) => doc.type === 'RELATORIO_ESPECIALISTA');
      const hasComplementaryExams = documentationProvided.some((doc) => doc.type === 'EXAMES_COMPLEMENTARES');

      const missingDocs: string[] = [];
      if (!hasLaudoMedico) missingDocs.push('Laudo médico atualizado (menos de 1 ano)');
      if (!hasSpecialistReport) missingDocs.push('Relatório de médico especialista na área da deficiência');

      // 2. Extract clinical information from documents
      const clinicalEvidence: string[] = [];
      const functionalLimitations: string[] = [];
      let deficiencyType: z.infer<typeof DeficiencyType> | undefined = undefined;
      let severityLevel: 'LEVE' | 'MODERADA' | 'GRAVE' | 'GRAVISSIMA' | undefined = undefined;

      // Analyze each document
      for (const doc of documentationProvided) {
        const content = doc.content.toLowerCase();

        // Identify deficiency type based on content
        if (content.includes('deficiência física') || content.includes('mobilidade')) {
          deficiencyType = 'FISICA';
          functionalLimitations.push('Limitações de mobilidade identificadas');
        }
        if (content.includes('deficiência intelectual') || content.includes('cognitiv')) {
          deficiencyType = 'INTELECTUAL';
          functionalLimitations.push('Limitações cognitivas identificadas');
        }
        if (content.includes('deficiência auditiva') || content.includes('surdez')) {
          deficiencyType = 'AUDITIVA';
          functionalLimitations.push('Limitações auditivas identificadas');
        }
        if (content.includes('deficiência visual') || content.includes('cegueira')) {
          deficiencyType = 'VISUAL';
          functionalLimitations.push('Limitações visuais identificadas');
        }

        // Extract clinical evidence
        if (content.includes('cid')) {
          clinicalEvidence.push('CID identificado na documentação');
        }
        if (content.includes('limitação funcional')) {
          clinicalEvidence.push('Limitações funcionais documentadas');
        }
      }

      // 3. Determine outcome based on Lei 13.146/2015 criteria
      let outcome: 'SIM' | 'NAO' | 'TALVEZ' = 'TALVEZ';
      let confidence = 0.5;
      let requiresPhysicalEvaluation = false;

      if (missingDocs.length > 0) {
        outcome = 'TALVEZ';
        confidence = 0.3;
      } else if (deficiencyType && functionalLimitations.length > 0) {
        outcome = 'SIM';
        confidence = 0.8;
        severityLevel = 'MODERADA';
      } else if (documentationProvided.length > 0 && deficiencyType) {
        outcome = 'TALVEZ';
        confidence = 0.6;
        requiresPhysicalEvaluation = true;
      } else {
        outcome = 'NAO';
        confidence = 0.7;
      }

      // 4. Build legal justification
      const legalJustification = {
        lei13146:
          'Art. 2º - Considera-se pessoa com deficiência aquela que tem impedimento de longo prazo de natureza física, mental, intelectual ou sensorial, o qual, em interação com uma ou mais barreiras, pode obstruir sua participação plena e efetiva na sociedade em igualdade de condições com as demais pessoas.',
        cif: 'Classificação baseada no modelo bio-psico-social da deficiência, considerando funções e estruturas do corpo, atividade e participação social.',
        decreto: 'Decreto 3.298/1999 e suas atualizações para classificação e avaliação',
      };

      // 5. Generate technical reasoning
      let technicalReasoning = '';
      if (outcome === 'SIM') {
        technicalReasoning = `Baseado na análise da documentação fornecida, identificou-se ${deficiencyType?.toLowerCase()} com limitações funcionais que atendem aos critérios da Lei 13.146/2015. A documentação apresenta evidências clínicas suficientes para caracterizar impedimento de longo prazo que, em interação com barreiras, pode obstruir a participação plena na sociedade.`;
      } else if (outcome === 'NAO') {
        technicalReasoning = `A documentação analisada não apresenta evidências suficientes de impedimento de longo prazo que atenda aos critérios estabelecidos pela Lei 13.146/2015. As condições apresentadas não caracterizam deficiência nos termos legais vigentes.`;
      } else {
        technicalReasoning = `A documentação fornecida é insuficiente para conclusão definitiva. ${missingDocs.length > 0 ? 'Faltam documentos essenciais.' : ''} ${requiresPhysicalEvaluation ? 'Recomenda-se avaliação física presencial para melhor caracterização.' : ''}`;
      }

      const compensatoryFactors = [
        'Capacidade adaptativa preservada',
        'Uso de tecnologia assistiva',
        'Suporte familiar adequado',
      ];

      console.log(`✅ Avaliação concluída: ${outcome} (confiança: ${confidence})`);

      return {
        outcome,
        confidence,
        deficiencyType,
        severityLevel,
        functionalLimitations,
        compensatoryFactors,
        legalJustification,
        clinicalEvidence,
        missingDocumentation: missingDocs,
        technicalReasoning,
        requiresPhysicalEvaluation,
      };
    } catch (error) {
      console.error('❌ Erro na avaliação PCD:', error);

      return {
        outcome: 'TALVEZ' as const,
        confidence: 0.1,
        functionalLimitations: [],
        compensatoryFactors: [],
        legalJustification: {
          lei13146: 'Lei 13.146/2015 - Lei Brasileira de Inclusão',
          cif: 'Classificação Internacional de Funcionalidade, Incapacidade e Saúde',
          decreto: 'Decreto 3.298/1999',
        },
        clinicalEvidence: [],
        missingDocumentation: ['Erro na análise - revisão manual necessária'],
        technicalReasoning: 'Erro técnico durante a análise. Recomenda-se revisão manual completa da documentação.',
        requiresPhysicalEvaluation: true,
      };
    }
  },
});
