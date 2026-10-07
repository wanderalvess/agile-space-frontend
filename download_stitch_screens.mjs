import { stitch } from "@google/stitch-sdk";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// Ignorar erro de certificado corporativo (SELF_SIGNED_CERT_IN_CHAIN)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const projectId = "3807546772419816831";
const screens = [
    { name: "01_tribe_level_multi_squad", id: "a0d01bfcc8324888b8f73763c5d3bad4" },
    { name: "02_tech_lead_engineering", id: "ad5871d85a5f49bd8c205c95f531d3ac" },
    { name: "03_people_lead_management", id: "1bd5dc8508624c0785936b8f32e80ace" },
    { name: "04_agile_master_governance", id: "ca1b29fe47484597a63e0326f53fb3e4" },
    { name: "05_product_owner_agile", id: "126a31dabc02491aa7349bcc63e59419" }
];

const outDir = "./stitch_exports";
fs.mkdirSync(`${outDir}/code`, { recursive: true });
fs.mkdirSync(`${outDir}/images`, { recursive: true });

async function downloadFile(url, destPath) {
    if (!url) {
        throw new Error("URL para download está vazia ou indefinida.");
    }
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Falha no download (HTTP ${res.status}): ${url}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destPath, buffer);
}

async function downloadScreens() {
    const project = stitch.project(projectId);

    console.log(`Buscando todas as telas do projeto ${projectId}...`);
    let projectScreens = [];
    try {
        projectScreens = await project.screens();
        console.log(`Encontradas ${projectScreens.length} telas no projeto:`);
        projectScreens.forEach((sc, i) => {
            console.log(`  [${i + 1}] ID: ${sc.id} | Título: ${sc.data?.title || 'Sem título'}`);
        });
    } catch (err) {
        console.warn("Aviso ao listar telas:", err.message);
    }

    // Se temos a lista dinâmica de telas do projeto, usamos elas; caso contrário, usamos a lista fixa
    const targetScreens = projectScreens.length > 0
        ? projectScreens.map((ps, idx) => ({
            id: ps.id,
            name: `${String(idx + 1).padStart(2, '0')}_${(ps.data?.title || ps.id).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`,
            title: ps.data?.title,
            screenObj: ps
        }))
        : screens.map(s => ({ ...s, screenObj: null }));

    for (const s of targetScreens) {
        console.log(`\n--------------------------------------------------`);
        console.log(`Processando tela: ${s.name} (${s.id})...`);
        try {
            const screenObj = s.screenObj || (await project.getScreen(s.id));
            
            if (screenObj.data) {
                console.log("Metadados:", JSON.stringify(screenObj.data, null, 2));
            }

            // Obtém as URLs hospedadas
            const htmlUrl = (await screenObj.getHtml()) || screenObj.data?.htmlCode?.downloadUrl;
            const imageUrl = (await screenObj.getImage()) || screenObj.data?.screenshot?.downloadUrl;

            const codeFile = path.join(outDir, "code", `${s.name}.html`);
            const imageFile = path.join(outDir, "images", `${s.name}.png`);

            if (htmlUrl) {
                console.log(`Baixando HTML -> ${codeFile}`);
                await downloadFile(htmlUrl, codeFile);
                console.log(`  ✓ HTML salvo com sucesso!`);
            } else {
                console.warn(`  ⚠️ URL do HTML não veio disponível na resposta da API.`);
            }

            if (imageUrl) {
                const highResImageUrl = imageUrl.includes('=w') ? imageUrl : `${imageUrl}=w1920`;
                console.log(`Baixando Imagem -> ${imageFile}`);
                await downloadFile(highResImageUrl, imageFile);
                console.log(`  ✓ Imagem salva com sucesso!`);
            } else {
                console.warn(`  ⚠️ URL da Imagem não encontrada para ${s.name}`);
            }
        } catch (screenErr) {
            console.error(`  ❌ Erro ao processar tela ${s.id}:`, screenErr.message);
        }
    }

    // Tenta exportar assets completos do projeto pelo método nativo do SDK
    console.log(`\n--------------------------------------------------`);
    console.log("Executando downloadAssets nativo do SDK para assets completos...");
    try {
        const assetsResult = await project.downloadAssets(path.join(outDir, "full_export"));
        console.log("✓ Exportação completa concluída:", assetsResult);
    } catch (assetErr) {
        console.warn("Aviso na exportação completa:", assetErr.message);
    }

    console.log("\n✅ Processamento finalizado!");
}

downloadScreens().catch(console.error);
