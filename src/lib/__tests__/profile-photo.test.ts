import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bestJiraAvatar,
  isJiraSystemAvatar,
  isUsablePhotoUrl,
  readProfilePhotoOff,
  readStoredProfilePhoto,
  resolveProfilePhoto,
  writeProfilePhotoOff,
  writeStoredProfilePhoto,
} from '../profile-photo';

const JIRA = {
  '16x16': 'https://jira.example/avatar?size=16',
  '24x24': 'https://jira.example/avatar?size=24',
  '32x32': 'https://jira.example/avatar?size=32',
  '48x48': 'https://jira.example/avatar?size=48',
};

describe('isUsablePhotoUrl', () => {
  it('aceita http, https e caminho do próprio site', () => {
    expect(isUsablePhotoUrl('https://a.b/c.png')).toBe(true);
    expect(isUsablePhotoUrl('http://a.b/c.png')).toBe(true);
    expect(isUsablePhotoUrl('/img/foto.png')).toBe(true);
  });
  it('recusa vazio, esquemas perigosos e valores que não são texto', () => {
    expect(isUsablePhotoUrl('')).toBe(false);
    expect(isUsablePhotoUrl('   ')).toBe(false);
    expect(isUsablePhotoUrl('javascript:alert(1)')).toBe(false);
    expect(isUsablePhotoUrl('data:image/png;base64,AAA')).toBe(false);
    expect(isUsablePhotoUrl('//evil.example/x.png')).toBe(false);
    expect(isUsablePhotoUrl(undefined)).toBe(false);
    expect(isUsablePhotoUrl(null)).toBe(false);
    expect(isUsablePhotoUrl(42)).toBe(false);
  });
});

describe('bestJiraAvatar', () => {
  it('escolhe a maior imagem disponível', () => {
    expect(bestJiraAvatar(JIRA)).toBe(JIRA['48x48']);
  });
  it('prefere 96 px ou mais quando existir', () => {
    expect(bestJiraAvatar({ ...JIRA, '128x128': 'https://jira.example/avatar?size=128' })).toBe('https://jira.example/avatar?size=128');
  });
  it('não depende da ordem das chaves', () => {
    expect(bestJiraAvatar({ '48x48': JIRA['48x48'], '16x16': JIRA['16x16'] })).toBe(JIRA['48x48']);
    expect(bestJiraAvatar({ '16x16': JIRA['16x16'], '48x48': JIRA['48x48'] })).toBe(JIRA['48x48']);
  });
  it('ignora tamanhos sem URL utilizável', () => {
    expect(bestJiraAvatar({ '48x48': '', '32x32': JIRA['32x32'], '24x24': 'javascript:x' })).toBe(JIRA['32x32']);
  });
  it('usa chave fora do padrão só quando não há outra', () => {
    expect(bestJiraAvatar({ xlarge: 'https://jira.example/x' })).toBe('https://jira.example/x');
    expect(bestJiraAvatar({ xlarge: 'https://jira.example/x', '16x16': JIRA['16x16'] })).toBe(JIRA['16x16']);
  });
  it('devolve undefined sem dados', () => {
    expect(bestJiraAvatar(undefined)).toBeUndefined();
    expect(bestJiraAvatar(null)).toBeUndefined();
    expect(bestJiraAvatar({})).toBeUndefined();
  });
});

describe('resolveProfilePhoto', () => {
  it('sem nenhuma fonte, não há foto', () => {
    expect(resolveProfilePhoto({})).toBeUndefined();
    expect(resolveProfilePhoto({ teamPhoto: '', jiraAvatarUrls: {}, storedPhoto: null })).toBeUndefined();
  });
  it('usa a foto do time quando não sincronizou agora', () => {
    expect(resolveProfilePhoto({ teamPhoto: 'https://t/foto.png' })).toBe('https://t/foto.png');
  });
  it('a foto recém-sincronizada vence a do time', () => {
    expect(resolveProfilePhoto({ teamPhoto: 'https://t/foto.png', jiraAvatarUrls: JIRA })).toBe(JIRA['48x48']);
  });
  it('a foto guardada só entra quando não há outra', () => {
    expect(resolveProfilePhoto({ storedPhoto: 'https://s/foto.png' })).toBe('https://s/foto.png');
    expect(resolveProfilePhoto({ teamPhoto: 'https://t/foto.png', storedPhoto: 'https://s/foto.png' })).toBe('https://t/foto.png');
  });
  it('descarta fonte inválida e cai na próxima', () => {
    expect(resolveProfilePhoto({ teamPhoto: 'javascript:x', storedPhoto: 'https://s/foto.png' })).toBe('https://s/foto.png');
  });
});

describe('foto guardada no navegador', () => {
  beforeEach(() => window.localStorage.clear());

  it('grava, lê e apaga por pessoa', () => {
    writeStoredProfilePhoto('u1', 'https://s/foto.png');
    expect(readStoredProfilePhoto('u1')).toBe('https://s/foto.png');
    expect(readStoredProfilePhoto('u2')).toBeUndefined();
    writeStoredProfilePhoto('u1', null);
    expect(readStoredProfilePhoto('u1')).toBeUndefined();
  });
  it('não guarda URL inválida e avisa quem escuta', () => {
    let calls = 0;
    const onChange = () => {
      calls += 1;
    };
    window.addEventListener('profile-photo-changed', onChange);
    writeStoredProfilePhoto('u1', 'javascript:x');
    window.removeEventListener('profile-photo-changed', onChange);
    expect(readStoredProfilePhoto('u1')).toBeUndefined();
    expect(calls).toBe(1);
  });
  it('sem id de pessoa não faz nada', () => {
    writeStoredProfilePhoto(undefined, 'https://s/foto.png');
    expect(readStoredProfilePhoto(undefined)).toBeUndefined();
  });
});

describe('isJiraSystemAvatar', () => {
  const b64 = (s: string) => Buffer.from(s, 'binary').toString('base64');

  it('SVG embutido é avatar de sistema', () => {
    expect(isJiraSystemAvatar(`data:image/svg+xml;base64,${b64('<svg id="bull"></svg>')}`)).toBe(true);
  });

  it('PNG com o marcador jira-system é avatar de sistema, mesmo rotulado como jpeg', () => {
    const png = b64('\x89PNG\r\n\x1a\n....tEXtjira-system-image-type\0avatar');
    expect(isJiraSystemAvatar(`data:image/png;base64,${png}`)).toBe(true);
    expect(isJiraSystemAvatar(`data:image/jpeg;base64,${png}`)).toBe(true);
  });

  it('foto comum e URLs contam como foto', () => {
    expect(isJiraSystemAvatar(`data:image/jpeg;base64,${b64('\xff\xd8\xff\xe0JFIF....')}`)).toBe(false);
    expect(isJiraSystemAvatar('https://jira.exemplo.com/secure/useravatar?ownerId=X&avatarId=1')).toBe(false);
    expect(isJiraSystemAvatar(undefined)).toBe(false);
    expect(isJiraSystemAvatar('')).toBe(false);
  });
});

describe('preferência "Usar minhas iniciais"', () => {
  beforeEach(() => window.localStorage.clear());

  it('liga, lê e desliga por pessoa, com a chave agile_profile_photo_off_<id>', () => {
    expect(readProfilePhotoOff('u1')).toBe(false);
    writeProfilePhotoOff('u1', true);
    expect(window.localStorage.getItem('agile_profile_photo_off_u1')).toBe('1');
    expect(readProfilePhotoOff('u1')).toBe(true);
    expect(readProfilePhotoOff('u2')).toBe(false);
    writeProfilePhotoOff('u1', false);
    expect(window.localStorage.getItem('agile_profile_photo_off_u1')).toBeNull();
    expect(readProfilePhotoOff('u1')).toBe(false);
  });

  it('avisa quem mostra o avatar ao mudar', () => {
    let calls = 0;
    const onChange = () => {
      calls += 1;
    };
    window.addEventListener('profile-photo-changed', onChange);
    writeProfilePhotoOff('u1', true);
    writeProfilePhotoOff('u1', false);
    window.removeEventListener('profile-photo-changed', onChange);
    expect(calls).toBe(2);
  });

  it('sem id de pessoa não faz nada', () => {
    writeProfilePhotoOff(undefined, true);
    expect(readProfilePhotoOff(undefined)).toBe(false);
    expect(window.localStorage.length).toBe(0);
  });

  it('sem armazenamento (erro ao ler ou gravar) a foto continua valendo e nada quebra', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(readProfilePhotoOff('u1')).toBe(false);
    expect(() => writeProfilePhotoOff('u1', true)).not.toThrow();
    get.mockRestore();
    set.mockRestore();
  });

  it('com a preferência ligada, resolveProfilePhoto devolve undefined mesmo havendo foto', () => {
    const input = { teamPhoto: 'https://t/foto.png', jiraAvatarUrls: JIRA, storedPhoto: 'https://s/foto.png' };
    expect(resolveProfilePhoto(input)).toBe(JIRA['48x48']);
    expect(resolveProfilePhoto({ ...input, photoOff: true })).toBeUndefined();
    expect(resolveProfilePhoto({ ...input, photoOff: false })).toBe(JIRA['48x48']);
  });
});
