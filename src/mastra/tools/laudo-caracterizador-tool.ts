import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const LaudoCaracterizadorData = z.object({
  // Dados do candidato
  candidateInfo: z.object({
    fullName: z.string(),
    cpf: z.string(),
    rg: z.string().optional(),
    birthDate: z.string(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
  }),

  // Dados médicos
  medicalInfo: z.object({
    deficiencyType: z.enum(['FISICA', 'INTELECTUAL', 'AUDITIVA', 'VISUAL', 'MULTIPLA', 'PSICOSSOCIAL']),
    cidCode: z.string().describe('Código CID da condição'),
    cifCode: z.string().optional().describe('Código CIF se aplicável'),
    diagnosis: z.string().describe('Diagnóstico principal'),
    onsetDate: z.string().optional().describe('Data de início da deficiência'),
    prognosis: z.enum(['TEMPORARIA', 'PERMANENTE']).describe('Prognóstico da deficiência'),
    severityLevel: z.enum(['LEVE', 'MODERADA', 'GRAVE', 'GRAVISSIMA']),
  }),

  // Avaliação funcional
  functionalAssessment: z.object({
    functionalLimitations: z.array(z.string()).describe('Limitações funcionais identificadas'),
    preservedFunctions: z.array(z.string()).describe('Funções preservadas'),
    adaptiveCapacity: z.string().describe('Capacidade adaptativa do indivíduo'),
    assistiveTechnology: z.array(z.string()).describe('Tecnologias assistivas utilizadas ou recomendadas'),
  }),

  // Informações profissionais
  professionalInfo: z.object({
    doctorName: z.string(),
    crm: z.string(),
    specialization: z.string(),
    issueDate: z.string(),
    expirationDate: z.string().optional(),
  }),

  // Base legal
  legalBasis: z.object({
    lei13146: z.boolean().default(true),
    decreto3298: z.boolean().default(true),
    cif: z.boolean().default(true),
    otherLaws: z.array(z.string()).optional(),
  }),
});

const LaudoOutput = z.object({
  laudoId: z.string().describe('ID único do laudo'),
  fullDocument: z.string().describe('Documento completo formatado'),
  summary: z.string().describe('Resumo executivo do laudo'),
  validityPeriod: z.string().describe('Período de validade do laudo'),
  digitalSignature: z.string().describe('Hash ou assinatura digital'),
  issuedAt: z.string().describe('Data e hora de emissão'),
  classification: z.object({
    pcdStatus: z.boolean().describe('Status PCD confirmado'),
    quotaEligible: z.boolean().describe('Elegível para cotas'),
    workRestrictions: z.array(z.string()).describe('Restrições laborais se houver'),
  }),
});

export const generateLaudoCaracterizador = createTool({
  id: 'generate-laudo-caracterizador',
  description: `Gera o Laudo Caracterizador de Pessoa com Deficiência oficial, documento legal que comprova
  o enquadramento de uma pessoa como PCD para fins trabalhistas e de cotas. Segue normas técnicas e
  exigências legais brasileiras.`,

  inputSchema: LaudoCaracterizadorData,
  outputSchema: LaudoOutput,

  execute: async ({ context }) => {
    const { candidateInfo, medicalInfo, functionalAssessment, professionalInfo, legalBasis } = context;

    console.log(`📋 Gerando Laudo Caracterizador para ${candidateInfo.fullName}`);
    console.log(`🏥 Médico responsável: Dr(a). ${professionalInfo.doctorName} - CRM ${professionalInfo.crm}`);

    try {
      const laudoId = `LAUDO-PCD-${Date.now()}-${candidateInfo.cpf.replace(/[^\d]/g, '')}`;
      const currentDate = new Date().toLocaleDateString('pt-BR');
      const currentDateTime = new Date().toLocaleString('pt-BR');

      // Generate comprehensive laudo document
      const fullDocument = `
LAUDO CARACTERIZADOR DE PESSOA COM DEFICIENCIA
===============================================

IDENTIFICACAO DO LAUDO
Numero do Laudo: ${laudoId}
Data de Emissao: ${currentDate}
Validade: 2 anos a partir da data de emissao

DADOS DO AVALIADO
Nome Completo: ${candidateInfo.fullName}
CPF: ${candidateInfo.cpf}
${candidateInfo.rg ? `RG: ${candidateInfo.rg}` : ''}
Data de Nascimento: ${candidateInfo.birthDate}
${candidateInfo.address ? `Endereco: ${candidateInfo.address}` : ''}
${candidateInfo.phone ? `Telefone: ${candidateInfo.phone}` : ''}
${candidateInfo.email ? `Email: ${candidateInfo.email}` : ''}

INFORMACOES MEDICAS
Tipo de Deficiencia: ${medicalInfo.deficiencyType}
Diagnostico Principal: ${medicalInfo.diagnosis}
CID-10: ${medicalInfo.cidCode}
${medicalInfo.cifCode ? `CIF: ${medicalInfo.cifCode}` : ''}
${medicalInfo.onsetDate ? `Data de Inicio: ${medicalInfo.onsetDate}` : ''}
Prognostico: ${medicalInfo.prognosis}
Grau da Deficiencia: ${medicalInfo.severityLevel}

AVALIACAO FUNCIONAL

Limitacoes Funcionais Identificadas:
${functionalAssessment.functionalLimitations.map((limitation) => `- ${limitation}`).join('\n')}

Funcoes Preservadas:
${functionalAssessment.preservedFunctions.map((func) => `- ${func}`).join('\n')}

Capacidade Adaptativa:
${functionalAssessment.adaptiveCapacity}

${
  functionalAssessment.assistiveTechnology.length > 0
    ? `
Tecnologias Assistivas:
${functionalAssessment.assistiveTechnology.map((tech) => `- ${tech}`).join('\n')}
`
    : ''
}

CONCLUSAO TECNICA
Com base na avaliacao medica realizada e na analise da documentacao apresentada,
ATESTO que ${candidateInfo.fullName}, portador(a) do CPF ${candidateInfo.cpf},
apresenta deficiencia do tipo ${medicalInfo.deficiencyType.toLowerCase()},
enquadrando-se nos criterios estabelecidos pela legislacao brasileira para
PESSOA COM DEFICIENCIA (PCD).

O diagnostico de ${medicalInfo.diagnosis} (CID-10: ${medicalInfo.cidCode})
configura impedimento de longo prazo que, em interacao com diversas barreiras,
pode obstruir a participacao plena e efetiva na sociedade em igualdade de
condicoes com as demais pessoas.

FUNDAMENTACAO LEGAL
${legalBasis.lei13146 ? '- Lei no 13.146/2015 (Lei Brasileira de Inclusao da Pessoa com Deficiencia)' : ''}
${legalBasis.decreto3298 ? '- Decreto no 3.298/1999 (Regulamenta a Lei no 7.853/1989)' : ''}
${legalBasis.cif ? '- Classificacao Internacional de Funcionalidade, Incapacidade e Saude (CIF/OMS)' : ''}
${legalBasis.otherLaws?.length ? legalBasis.otherLaws.map((law) => `- ${law}`).join('\n') : ''}

Este laudo tem validade de 2 (dois) anos a partir da data de emissao e
foi elaborado de acordo com as normas tecnicas vigentes e criterios
estabelecidos pela legislacao brasileira.

RESPONSAVEL TECNICO
Dr(a). ${professionalInfo.doctorName}
CRM: ${professionalInfo.crm}
Especialidade: ${professionalInfo.specialization}

_________________________________
Assinatura e Carimbo

Data: ${currentDate}
Local: Sao Paulo/SP

===============================================
Este documento possui validade legal e foi emitido em conformidade
com a legislacao brasileira vigente sobre pessoas com deficiencia.
`.trim();

      // Generate summary
      const summary = `Laudo Caracterizador emitido para ${candidateInfo.fullName} confirmando enquadramento como PCD tipo ${medicalInfo.deficiencyType} com base no diagnostico ${medicalInfo.diagnosis} (${medicalInfo.cidCode}). Deficiencia classificada como ${medicalInfo.severityLevel} com prognostico ${medicalInfo.prognosis}. Documento valido por 2 anos.`;

      // Calculate validity period
      const validityDate = new Date();
      validityDate.setFullYear(validityDate.getFullYear() + 2);
      const validityPeriod = `${currentDate} ate ${validityDate.toLocaleDateString('pt-BR')}`;

      // Generate digital signature (simplified hash)
      const digitalSignature = `SHA256-${Buffer.from(laudoId + candidateInfo.cpf + currentDateTime).toString('base64').substring(0, 16)}`;

      // Determine work restrictions based on deficiency type
      const workRestrictions: string[] = [];
      if (medicalInfo.deficiencyType === 'FISICA') {
        workRestrictions.push('Atividades que exijam grande esforco fisico');
        workRestrictions.push('Trabalhos em altura sem adaptacoes adequadas');
      } else if (medicalInfo.deficiencyType === 'VISUAL') {
        workRestrictions.push('Atividades que dependam exclusivamente da visao');
        workRestrictions.push('Conducao de veiculos sem adaptacoes');
      } else if (medicalInfo.deficiencyType === 'AUDITIVA') {
        workRestrictions.push('Ambientes com exigencia de comunicacao oral sem adaptacoes');
      }

      console.log(`✅ Laudo ${laudoId} gerado com sucesso`);
      console.log(`⏰ Valido ate: ${validityDate.toLocaleDateString('pt-BR')}`);

      return {
        laudoId,
        fullDocument,
        summary,
        validityPeriod,
        digitalSignature,
        issuedAt: currentDateTime,
        classification: {
          pcdStatus: true,
          quotaEligible: true,
          workRestrictions,
        },
      };
    } catch (error) {
      console.error('❌ Erro na geracao do laudo:', error);

      const errorLaudoId = `ERROR-${Date.now()}`;
      return {
        laudoId: errorLaudoId,
        fullDocument: 'ERRO: Nao foi possivel gerar o laudo. Favor revisar os dados fornecidos.',
        summary: 'Erro na geracao do laudo caracterizador',
        validityPeriod: 'Invalido',
        digitalSignature: 'INVALID',
        issuedAt: new Date().toLocaleString('pt-BR'),
        classification: {
          pcdStatus: false,
          quotaEligible: false,
          workRestrictions: ['Documento invalido devido a erro de geracao'],
        },
      };
    }
  },
});
