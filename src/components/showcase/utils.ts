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

  // Google Drive
  const driveMatch = cleanUrl.match(/drive\.google\.com\/file\/d\/([^\/\?]+)/) || cleanUrl.match(/id=([^\/\?&]+)/);
  if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;

  const loomMatch = cleanUrl.match(/loom\.com\/share\/([^\/\?]+)/);
  if (loomMatch) return `https://www.loom.com/embed/${loomMatch[1]}`;

  const ytMatch = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([^\/\?&]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  // PDFs Genéricos ou Google Drive (preview já tratado acima se for link drive)
  if (isPdfUrl(cleanUrl) && !cleanUrl.includes('drive.google.com')) {
    return cleanUrl;
  }

  return cleanUrl;
};

export const isPdfUrl = (url: string) => {
  if (!url) return false;
  const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
  return cleanUrl.endsWith('.pdf') || url.includes('drive.google.com') && (url.includes('/file/d/') || url.includes('id='));
};

export const getDirectImageUrl = (url: string) => {
  if (!url) return '';
  
  // Google Drive
  const driveMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([^\/\?&]+)/) || url.match(/id=([^\/\?&]+)/);
  if (driveMatch) {
    // Usando endpoint lh3 que é mais direto e performático para o navegador
    // Aceita parâmetros de redimensionamento de forma muito eficiente
    return `https://lh3.googleusercontent.com/d/${driveMatch[1]}=w1600`;
  }

  // Dropbox
  if (url.includes('dropbox.com')) {
    return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '').replace('?dl=1', '');
  }

  return url;
};

export const extractMediaUrl = (text: string) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s"']+)/g;
  const matches = text.match(urlRegex);
  if (!matches) return null;
  
  // Prioritiza PDF, depois Vídeo (Loom/YT), depois Imagens
  const pdf = matches.find(u => isPdfUrl(u));
  if (pdf) return pdf;
  
  const video = matches.find(u => u.includes('loom.com') || u.includes('youtube.com') || u.includes('youtu.be'));
  if (video) return video;
  
  const img = matches.find(u => u.match(/\.(jpeg|jpg|gif|png|webp|svg)/i));
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
    versionMaster: issue.versionMaster || '',
    versionDevelop: issue.versionDevelop || '',
    versionRelease: issue.versionRelease || '',
  };
};
