import { Client, LocalAuth, Message } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';
import * as fs from 'fs';
import * as path from 'path';

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
        ]
    },
    webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    }
});
    

// Carregar produtos do CSV
let produtos: any[] = [];

function carregarProdutos() {
    try {
        const csvPath = path.join(__dirname, '..', 'produtos-clean.csv');
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        const linhas = csvContent.split('\n').slice(1); // Pula o cabeçalho
        
        produtos = linhas
            .filter(linha => linha.trim())
            .map(linha => {
                const colunas = linha.split(',');
                return {
                    id: colunas[0]?.replace(/"/g, '').trim(),
                    nome: colunas[1]?.replace(/"/g, '').trim(),
                    preco: colunas[2]?.replace(/"/g, '').trim(),
                    descricao: colunas[3]?.replace(/"/g, '').trim() || 'Sem descrição',
                    categoria: colunas[4]?.replace(/"/g, '').trim(),
                    barcode: colunas[5]?.replace(/"/g, '').trim()
                };
            })
            .filter(p => p.id && p.nome); // Remove produtos inválidos
        
        console.log(`✅ ${produtos.length} produtos carregados!`);
    } catch (error) {
        console.error('❌ Erro ao carregar produtos:', error);
        // Produtos de exemplo caso o CSV não carregue
        produtos = [
            { id: '1', nome: 'Produto A', preco: 'R$ 50,00', descricao: 'Descrição do produto A' },
            { id: '2', nome: 'Produto B', preco: 'R$ 75,00', descricao: 'Descrição do produto B' }
        ];
    }
}

client.on('qr', (qr: string) => {
    console.log('📱 Escaneie o QR Code abaixo com seu WhatsApp:');
    (qrcode as any).generate(qr, { small: true });
    
});

client.on('ready', () => {
    console.log('✅ Bot conectado e pronto!');
    console.log('📞 Aguardando mensagens...');
    carregarProdutos(); // Carregar produtos quando conectar
});

client.on('message', async (message: Message) => {
    try {
        console.log('🔔 MENSAGEM DETECTADA!');
    console.log('De:', message.from);
    console.log('Texto:', message.body);
        const chat = await message.getChat();
        if (chat.isGroup) return;

        const msgText = message.body.toLowerCase().trim();
        const clientName = 'Cliente';

        console.log(`📩 Mensagem recebida: ${message.body}`);

        // Menu principal
        if (msgText === 'menu' || msgText === 'oi' || msgText === 'olá' || msgText === 'ola') {
            const menuMessage = `Olá, ${clientName}! 👋

Bem-vindo ao nosso atendimento automático!

Digite uma das opções abaixo:

*1* - Ver catálogo de produtos
*2* - Buscar produto por nome
*3* - Fazer um pedido
*4* - Falar com atendente
*5* - Informações de contato

_Digite o número da opção desejada_`;

            await message.reply(menuMessage);
            return;
        }

        // Opção 1: Mostrar primeiros produtos
        if (msgText === '1' || msgText === 'catalogo' || msgText === 'catálogo' || msgText === 'produtos') {
            const primeiros20 = produtos.slice(0, 20);
            let catalogoMsg = `*📦 CATÁLOGO DE PRODUTOS*\n\n`;
            catalogoMsg += `_Mostrando ${primeiros20.length} de ${produtos.length} produtos_\n\n`;
            
            primeiros20.forEach(produto => {
                catalogoMsg += `*ID: ${produto.id}* - ${produto.nome}\n`;
                catalogoMsg += `   💰 ${produto.preco}\n\n`;
            });

            catalogoMsg += '\n_Para buscar um produto específico, digite: *buscar* seguido do nome_\n';
            catalogoMsg += '_Exemplo: buscar açúcar_';

            await message.reply(catalogoMsg);
            return;
        }

        // Opção 2: Buscar produto
        if (msgText.startsWith('buscar ') || msgText.startsWith('2')) {
            const termo = msgText.replace('buscar ', '').replace('2 ', '').trim();
            
            if (!termo || termo === '2') {
                await message.reply('Para buscar, digite: *buscar* seguido do nome do produto\n\nExemplo: *buscar açúcar*');
                return;
            }

            const resultados = produtos.filter(p => 
                p.nome.toLowerCase().includes(termo.toLowerCase())
            ).slice(0, 10);

            if (resultados.length === 0) {
                await message.reply(`❌ Nenhum produto encontrado com "${termo}"\n\nTente outro nome ou digite *1* para ver o catálogo.`);
                return;
            }

            let resultadoMsg = `*🔍 Resultados para "${termo}":*\n\n`;
            resultados.forEach(produto => {
                resultadoMsg += `*ID: ${produto.id}* - ${produto.nome}\n`;
                resultadoMsg += `   💰 ${produto.preco}\n\n`;
            });

            resultadoMsg += '\n_Para fazer pedido, digite: *pedido* seguido do ID_\n';
            resultadoMsg += '_Exemplo: pedido 5831_';

            await message.reply(resultadoMsg);
            return;
        }

        // Opção 3: Pedido
        if (msgText === '3' || msgText.startsWith('pedido')) {
            const pedidoMatch = msgText.match(/pedido\s*(\d+)/);
            
            if (pedidoMatch) {
                const produtoId = pedidoMatch[1];
                const produto = produtos.find(p => p.id === produtoId);

                if (produto) {
                    const pedidoMsg = `✅ *Pedido Registrado!*

*ID:* ${produto.id}
*Produto:* ${produto.nome}
*Descrição:* ${produto.descricao}
*Valor:* ${produto.preco}
*Código de Barras:* ${produto.barcode || 'N/A'}

Em breve um atendente entrará em contato para confirmar seu pedido!

_Digite *menu* para voltar ao menu principal_`;

                    await message.reply(pedidoMsg);
                    console.log(`🛒 Novo pedido - ${produto.nome}`);
                } else {
                    await message.reply('❌ Produto não encontrado. Digite *1* para ver o catálogo ou *buscar* para procurar.');
                }
            } else {
                await message.reply('Para fazer um pedido, digite:\n*pedido* seguido do ID do produto\n\nExemplo: *pedido 5831*');
            }
            return;
        }

        // Opção 4: Atendente
        if (msgText === '4' || msgText === 'atendente') {
            const atendenteMsg = `👤 *Solicitação de Atendimento*

Sua solicitação foi registrada!
Um de nossos atendentes entrará em contato em breve.

⏰ Horário de atendimento: 
Segunda a Sexta: 9h às 18h
Sábado: 9h às 13h

_Digite *menu* para voltar ao menu principal_`;

            await message.reply(atendenteMsg);
            console.log(`👤 Solicitação de atendimento humano`);
            return;
        }

        // Opção 5: Contato
        if (msgText === '5' || msgText === 'contato' || msgText === 'informações' || msgText === 'informacoes') {
            const contatoMsg = `📞 *Informações de Contato*

📧 Email: contato@casadasemente.com
📱 WhatsApp: (19) 99999-9999
🌐 Site: www.casadasemente.com.br
📍 Endereço: Campinas, SP

_Digite *menu* para voltar ao menu principal_`;

            await message.reply(contatoMsg);
            return;
        }

        // Resposta padrão
        await message.reply(`Desculpe, não entendi sua mensagem. 😅\n\nDigite *menu* para ver as opções disponíveis.`);

    } catch (error) {
        console.error('❌ Erro ao processar mensagem:', error);
    }
});

console.log('🚀 Iniciando bot WhatsApp...');
client.initialize();