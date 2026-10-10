import { Evidence, ShowcaseTask, PRESENTATION_PRESETS } from './types';

/**
 * Determina com precisão se o fundo escolhido para a apresentação é claro.
 * Usado para ajustar tipografia, contraste de bordas, badges e controles no Modo Teatro.
 */
export const isLightBackground = (bg?: string): boolean => {
  if (!bg) return false;
  const val = bg.trim().toLowerCase();
  if (['#ffffff', '#fff', 'white', '#fafafa', '#f8fafc', '#f1f5f9', '#f0f9ff', '#fafaf9', '#f5f5f4', '#f3f4f6'].includes(val)) {
    return true;
  }
  const preset = PRESENTATION_PRESETS.find(p => p.value.toLowerCase() === val);
  if (preset && 'isLight' in preset) {
    return !!preset.isLight;
  }
  if (val.includes('#f8fafc') || val.includes('#f0f9ff') || val.includes('#fafaf9') || val.includes('#ffffff') || val.includes('#e2e8f0') || val.includes('#e0f2fe')) {
    return true;
  }
  const hexMatch = val.match(/^#([0-9a-f]{6})$/i);
  if (hexMatch) {
    const r = parseInt(hexMatch[1].slice(0, 2), 16);
    const g = parseInt(hexMatch[1].slice(2, 4), 16);
    const b = parseInt(hexMatch[1].slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
    return luminance > 175;
  }
  return false;
};

/**
 * Prontidão real de uma task, derivada do conteúdo preenchido — a mesma
 * conta que colore a borda do TaskCard. Fonte única: antes disso o header da
 * sala contava `preparationStatus` (dropdown manual, esquecível) e o card
 * calculava isReady por conta própria, podendo discordar sem aviso nenhum.
 */
/**
 * Link digitado por uma pessoa e aberto por outra (window.open, iframe, href): só http/https passa.
 * Sem esquema ("tdn.totvs.com/x") vira https://; esquemas que executam código (javascript:, data:...) viram ''.
 */
export const toSafeUrl = (raw?: string | null): string => {
  const value = (raw ?? '').trim();
  if (!value) return '';
   
  const compact = value.replace(/[\u0000- \u007f]/g, '');
  if (/^[a-z][a-z0-9+.-]*:/i.test(compact)) {
    return /^https?:/i.test(compact) ? value : '';
  }
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('/')) return value;
  return `https://${value}`;
};

/** Abre um link já validado sem dar acesso à janela de origem. */
export const openSafeUrl = (raw?: string | null): boolean => {
  const url = toSafeUrl(raw);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
};

/** Ordem natural: PROJ-2 vem antes de PROJ-10. */
export const compareText = (a?: string | null, b?: string | null): number =>
  (a ?? '').localeCompare(b ?? '', 'pt-BR', { numeric: true, sensitivity: 'base' });

export const isTaskContentComplete =(task: Pick<ShowcaseTask, 'cardKind' | 'evidence' | 'metrics' | 'attachments'>): boolean => {
  if (task.cardKind === 'metrics') {
    return (task.metrics || []).some(m => (m.field || '').trim() && m.value);
  }
  // Arquivo anexado no card vale como evidência, igual a print ou vídeo.
  const hasEvidence = !!(task.evidence.screenshot || task.evidence.video || (task.attachments?.length ?? 0) > 0);
  return !!(task.evidence.problem && task.evidence.solution && hasEvidence);
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
};

export const formatTime = (seconds?: number) => {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

export const getEmbedUrl = (url: string) => {
  if (!url) return '';
  
  let cleanUrl = url.replace(/&amp;/g, '&');
  if (cleanUrl.includes('google.com/search?q=')) {
    const match = cleanUrl.match(/q=([^&]+)/);
    if (match) cleanUrl = decodeURIComponent(match[1]);
  }

  // Loom e YouTube primeiro: o link de compartilhamento do Loom traz "?sid=", e o "id=" do Drive casava dentro dele.
  const loomMatch = cleanUrl.match(/loom\.com\/(?:share|embed)\/([^\/\?#]+)/);
  if (loomMatch) return `https://www.loom.com/embed/${loomMatch[1]}`;

  const ytMatch = cleanUrl.match(/youtu\.be\/([^\/\?#&]+)/)
    || cleanUrl.match(/youtube\.com\/(?:shorts|live|embed)\/([^\/\?#&]+)/)
    || cleanUrl.match(/youtube\.com\/watch\?(?:[^#]*&)?v=([^&#]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  const driveId = getDriveFileId(cleanUrl);
  if (driveId) return `https://drive.google.com/file/d/${driveId}/preview`;

  // PDFs Genéricos ou Google Drive (preview já tratado acima se for link drive)
  if (isPdfUrl(cleanUrl) && !cleanUrl.includes('drive.google.com')) {
    return cleanUrl;
  }

  return cleanUrl;
};

/** Id de arquivo do Google Drive, só quando o host é o do Drive (um "id=" qualquer na query não conta). */
export const getDriveFileId = (url: string): string | null => {
  if (!/^(?:https?:\/\/)?drive\.google\.com\//i.test(url.trim())) return null;
  const match = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([^\/\?&#]+)/)
    || url.match(/drive\.google\.com\/[^#]*[?&]id=([^\/\?&#]+)/);
  return match ? match[1] : null;
};

export const isPdfUrl = (url: string) => {
  if (!url) return false;
  const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
  return cleanUrl.endsWith('.pdf') || !!getDriveFileId(url);
};

/** Extensão de imagem na URL (não em qualquer pedaço do host: "app.gifted.com" não é imagem). */
export const isImageUrl = (url: string): boolean =>
  /\.(?:jpe?g|gif|png|webp|svg)(?:$|[/?#])/i.test(url) || url.includes('images.unsplash.com');

/**
 * Fundo da apresentação é imagem (vira `url(...)`) ou CSS puro (cor/gradiente). Além de links
 * http, aceita arquivos do próprio app em `public/` (ex.: `/showcase/fundo-totvs.webp`).
 */
export const isImageBackground = (value?: string): boolean =>
  !!value && (/^https?:\/\//i.test(value) || (value.startsWith('/') && !value.startsWith('//')));

/** Véu sobre fundo de imagem: escurece o bastante para ler o card sem esconder a foto. */
export const imageBackgroundCss = (url: string) =>
  `linear-gradient(rgba(5, 5, 16, 0.55), rgba(5, 5, 16, 0.8)), url(${JSON.stringify(url)})`;

export const getDirectImageUrl = (url: string) => {
  if (!url) return '';
  
  // Google Drive (só links do próprio Drive; o endpoint lh3 é mais direto e aceita redimensionamento)
  const driveId = getDriveFileId(url);
  if (driveId) {
    return `https://lh3.googleusercontent.com/d/${driveId}=w1600`;
  }

  // Dropbox
  if (url.includes('dropbox.com')) {
    return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '').replace('?dl=1', '');
  }

  return url;
};

/**
 * Remove marcação wiki do Jira que ainda sobrou no texto salvo (problema/
 * solução/critérios) — mesma regra do stripWikiMarkup em jiraService.ts, mas
 * aplicada aqui na exibição/exportação porque nem todo texto que chega no
 * showcase passou pela extração daquele serviço (ex.: sessão antiga, edição
 * manual, ou campo colado direto do Jira). Sem isso "h2. *Solução:*" aparece
 * literal em vez de virar "Solução:".
 */
export const stripWikiMarkup = (text?: string): string => {
  if (!text) return text || '';
  return text
    .replace(/^h[1-6]\.[ \t]*/gm, '')
    .replace(/\{color[^}]*\}([\s\S]*?)\{color\}/gi, '$1')
    .replace(/\{(?:quote|noformat|code[^}]*)\}([\s\S]*?)\{\/?(?:quote|noformat|code)\}/gi, '$1')
    .replace(/\*(\S(?:[^*\n]*\S)?)\*/g, '$1')
    .replace(/^-{3,}[ \t]*$/gm, '');
};

/**
 * As fontes padrão do jsPDF (Helvetica/WinAnsi) não têm glifo pra emoji —
 * qualquer codepoint fora do Latin-1 vira lixo visual no PDF (ex.: "📝" virou
 * "Ø=ÜÝ" na exportação). No app normal o emoji renderiza certo (fonte do
 * navegador cobre), então isso só se aplica ao texto que vai pro jsPDF.
 */
export const stripNonLatin1ForPdf = (text?: string): string => {
  if (!text) return text || '';
  // Pontuação tipográfica comum (colada do Word/Jira) vira o equivalente ASCII em vez de sumir.
  const typographic = text
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/…/g, '...')
    .replace(/[•●▪]/g, '-')
    .replace(/[  ]/g, ' ');
  return Array.from(typographic).filter(ch => ch.codePointAt(0)! <= 0xFF).join('');
};

/**
 * Screenshot e vídeo podem coexistir — cada um pode ser imagem ou vídeo, o
 * tipo é sempre detectado pelo conteúdo da URL (ver getEmbedUrl/isPdfUrl),
 * nunca pelo campo de origem. `evidencePreference` só decide qual delas abre
 * primeiro no Modo Teatro quando as duas estão preenchidas — quem apresenta
 * ainda alterna pra outra por lá, nenhuma fica inacessível.
 */
export const getEvidenceUrls = (evidence: Pick<Evidence, 'screenshot' | 'video' | 'evidencePreference'>): string[] => {
  const preferScreenshot = evidence.evidencePreference === 'screenshot';
  const ordered = preferScreenshot ? [evidence.screenshot, evidence.video] : [evidence.video, evidence.screenshot];
  // Filtra também na exibição: sessões importadas antes da correção já têm o
  // ícone salvo como evidência.
  return ordered.map(u => toSafeUrl(u)).filter((u): u is string => !!u && !isJiraDecorativeImage(u));
};

/**
 * Imagens que o Jira insere na descrição só como decoração: emoticons
 * (`/images/icons/emoticons/warning.png`), ícones de tipo/prioridade/status e
 * avatares. Não são evidência de entrega e não devem virar o print do card.
 */
export const isJiraDecorativeImage = (url: string): boolean =>
  /\/images\/icons\/|\/emoticons\/|\/secure\/(?:useravatar|viewavatar|projectavatar)|\/rest\/api\/\d+\/universal_avatar\//i.test(url);

export const extractMediaUrl = (text: string) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s"']+)/g;
  // A marcação wiki do Jira cola "!", "|" e "]" no fim do link: "!https://x/a.png!" -> "https://x/a.png".
  const matches = text.match(urlRegex)
    ?.map(u => u.split('|')[0].replace(/[!\])},.;:]+$/, ''))
    .filter(u => u && !isJiraDecorativeImage(u));
  if (!matches || matches.length === 0) return null;
  
  // Prioritiza PDF, depois Vídeo (Loom/YT), depois Imagens
  const pdf = matches.find(u => isPdfUrl(u));
  if (pdf) return pdf;
  
  const video = matches.find(u => u.includes('loom.com') || u.includes('youtube.com') || u.includes('youtu.be'));
  if (video) return video;
  
  const img = matches.find(u => isImageUrl(u));
  if (img) return img;
  
  return matches[0]; // Retorna a primeira URL se não der match em nada específico
};

export const makeTask = (issue: any): any => {
  const titleScan = issue.title?.match(/(?:Dev\s*)?(\d+(?:\.\d+)?)h\s*[\/|]\s*(?:Q\.?A\.?\s*)?(\d+(?:\.\d+)?)h/i);
  
  // Se não achar no scan do título, tenta pegar do objeto planned do issue (se vier do service)
  const plannedDev = (titleScan ? titleScan[1] + 'h' : '') || issue.planned?.dev || '';
  const plannedQa = (titleScan ? titleScan[2] + 'h' : '') || issue.planned?.qa || '';
  
  const problem = issue.problem || issue.description || '';
  const solution = issue.solution || '';
  const dev = issue.devName || issue.assignee || '';
  const qa = issue.qa || '';
  
  return {
    id: (issue.key || 'UNKNOWN') + '_' + Math.random().toString(36).substr(2, 6),
    key: issue.key || '', 
    title: issue.title || '', 
    description: issue.description || '',
    acceptanceCriteria: issue.acceptanceCriteria || '', 
    type: issue.type || 'Evolução',
    status: issue.status || 'In Progress', 
    priority: issue.priority || 'Medium', 
    points: issue.points || 0,
    assignee: issue.assignee || '', 
    url: issue.url || '',
    evidence: { 
      problem: problem, 
      solution: solution, 
      dev: dev, 
      qa: qa, 
      screenshot: issue.screenshot || extractMediaUrl(issue.description || '') || '', 
      video: issue.videoUrl || (extractMediaUrl(issue.description || '')?.includes('loom.com') ? extractMediaUrl(issue.description || '') : '') || '',
      techDocUrl: issue.techDocUrl || '',
      tdnUrl: issue.tdnUrl || '',
      timeSpent: issue.timeSpent || 0,
      timeEstimate: issue.timeEstimate || 0,
      planned: {
        dev: plannedDev,
        qa: plannedQa,
        tu: issue.planned?.tu || ''
      }
    },
    decision: 'open', 
    preparationStatus: 'todo',
    feedback: '',
    project: issue.project || '',
    versionSuporte: issue.versionSuporte || '',
    versionMaster: issue.versionMaster || '',
    versionRelease: issue.versionRelease || '',
    versionDevelop: issue.versionDevelop || '',
  };
};
