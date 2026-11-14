/**
 * Idempotent: wipes everything and recreates 2 companies with their catalogs, one admin and one user each.
 * The catalogs are from different domains so tenant isolation is obvious in the chat.
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../src/config/env';
import { CompanyModel } from '../src/models/company.model';
import { ConversationModel } from '../src/models/conversation.model';
import { ProductModel } from '../src/models/product.model';
import { UserModel } from '../src/models/user.model';

const PASSWORD = 'senha123';
const img = (photoId: string) => `https://images.unsplash.com/photo-${photoId}?w=800&h=800&q=75&auto=format&fit=crop`;

type SeedProduct = { name: string; description: string; price: number; category: string; image: string };

const COMPANIES: { name: string; slug: string; domain: string; products: SeedProduct[] }[] = [
  {
    name: 'TechNova Eletrônicos',
    slug: 'technova',
    domain: 'technova.com',
    products: [
      { name: 'Notebook UltraBook Pro 14"', category: 'Notebooks', price: 6899.9, image: img('1611186871348-b1ce696e52c9'),
        description: 'Notebook ultrafino em alumínio com Intel Core i7 de 13ª geração, 16 GB de RAM LPDDR5 e SSD NVMe de 512 GB. Tela 14" 2.8K OLED com 100% DCI-P3, pesa 1,2 kg e tem bateria de até 14 horas. Duas portas Thunderbolt 4 e Wi-Fi 6E.' },
      { name: 'Notebook Gamer Titan 16"', category: 'Notebooks', price: 9499, image: img('1640955014216-75201056c829'),
        description: 'Notebook gamer com GeForce RTX 4070 de 8 GB, AMD Ryzen 9, 32 GB de RAM DDR5 e SSD de 1 TB. Tela 16" QHD de 240 Hz, teclado RGB por tecla e refrigeração com câmara de vapor para sessões longas sem perder desempenho.' },
      { name: 'Notebook Essencial 15"', category: 'Notebooks', price: 2999, image: img('1496181133206-80ce9b88a853'),
        description: 'Notebook para estudo e trabalho do dia a dia: Intel Core i5, 8 GB de RAM (expansível até 24 GB), SSD de 256 GB e tela Full HD de 15,6" antirreflexo. Leve, com Wi-Fi 6, webcam HD e teclado numérico.' },
      { name: 'Tablet NovaTab 11"', category: 'Tablets', price: 2799, image: img('1561154464-82e9adf32764'),
        description: 'Tablet com tela 11" 2.5K de 120 Hz, 8 GB de RAM e 256 GB de armazenamento. Quatro alto-falantes, suporte a caneta e teclado magnético, bateria de 8.000 mAh para até 12 horas de vídeo.' },
      { name: 'Smartphone Nova X12 256 GB', category: 'Smartphones', price: 4299.9, image: img('1557774058-c9148bc6e481'),
        description: 'Smartphone 5G com tela AMOLED 6,7" de 120 Hz, câmera principal de 200 MP com estabilização óptica, 12 GB de RAM e bateria de 5.000 mAh com carregamento de 67 W (0 a 100% em 40 minutos). Resistente à água IP68.' },
      { name: 'Smartphone Nova Lite 128 GB', category: 'Smartphones', price: 1599, image: img('1612442443556-09b5b309e637'),
        description: 'Smartphone de entrada com tela 6,5" de 90 Hz, câmera de 50 MP, 6 GB de RAM e bateria de 5.000 mAh que dura até dois dias. NFC, leitor de digital lateral e entrada para cartão microSD. Ótimo custo-benefício.' },
      { name: 'Fone Bluetooth SoundPods ANC', category: 'Áudio', price: 699.9, image: img('1655560378428-7605bda51749'),
        description: 'Fones intra-auriculares sem fio com cancelamento ativo de ruído, modo ambiente e três microfones por lado para chamadas nítidas. Resistência à água IPX5, 8 horas de uso e até 30 horas com o estojo de carregamento.' },
      { name: 'Headphone Studio Over-Ear', category: 'Áudio', price: 1299, image: img('1546435770-a3e426bf472b'),
        description: 'Headphone over-ear com cancelamento de ruído adaptativo, áudio Hi-Res e conexão multiponto com dois aparelhos ao mesmo tempo. 40 horas de bateria, carga rápida (10 minutos = 5 horas) e almofadas de espuma com memória.' },
      { name: 'Caixa de Som Boom 360', category: 'Áudio', price: 549, image: img('1589003077984-894e133dabab'),
        description: 'Caixa de som Bluetooth portátil com som 360° e iluminação LED sincronizada com a música. À prova d\'água e poeira (IP67), 20 horas de bateria e pareamento estéreo com uma segunda unidade.' },
      { name: 'Smartwatch Pulse 2', category: 'Wearables', price: 1199, image: img('1624096104992-9b4fa3a279dd'),
        description: 'Relógio inteligente com GPS integrado, monitor cardíaco e de oxigenação, análise de sono e mais de 100 modos esportivos. Tela AMOLED always-on de 1,9", resistente à água 5 ATM e até 10 dias de bateria.' },
      { name: 'Monitor 27" 4K ProView', category: 'Monitores', price: 2399, image: img('1587831990711-23ca6441447b'),
        description: 'Monitor IPS 27" 4K UHD com 99% sRGB e HDR400. Porta USB-C com 65 W de carga (um cabo para imagem e energia do notebook), base com ajuste de altura, inclinação e rotação. Perfeito para design e produtividade.' },
      { name: 'Teclado Mecânico TKL RGB', category: 'Periféricos', price: 459.9, image: img('1618384887929-16ec33fab9ef'),
        description: 'Teclado mecânico compacto (tenkeyless) com switches marrons hot-swap, keycaps PBT e iluminação RGB. Conexão com fio USB-C, Bluetooth para até três aparelhos ou 2,4 GHz. Layout ABNT2.' },
      { name: 'Mouse Sem Fio Ergo Silent', category: 'Periféricos', price: 189.9, image: img('1658070429465-848c0796abf3'),
        description: 'Mouse ergonômico sem fio com cliques silenciosos, sensor de 4.000 DPI e bateria recarregável via USB-C que dura até 70 dias. Conecta em até três dispositivos e alterna entre eles com um botão.' },
      { name: 'Webcam Full HD StreamCam', category: 'Periféricos', price: 399, image: img('1623949556303-b0d17d198863'),
        description: 'Webcam Full HD 1080p a 60 fps com foco automático, correção de luz e dois microfones com redução de ruído. Encaixa no monitor ou no tripé, tem tampa de privacidade e funciona sem instalar drivers.' },
      { name: 'Câmera Mirrorless Vision Z', category: 'Câmeras', price: 7490, image: img('1452780212940-6f5c0d14d848'),
        description: 'Câmera mirrorless com sensor APS-C de 26 MP, gravação 4K a 60 fps e foco automático com detecção de olhos. Estabilização no corpo de 5 eixos, tela articulada e kit com lente 18-55 mm.' },
      { name: 'Carregador GaN 67 W USB-C', category: 'Acessórios', price: 229, image: img('1731616103600-3fe7ccdc5a59'),
        description: 'Carregador compacto com tecnologia GaN e 67 W de potência: carrega notebook, tablet e smartphone. Acompanha cabo USB-C de 1 m e tem proteção contra superaquecimento e sobrecarga.' },
      { name: 'Power Bank 20.000 mAh', category: 'Acessórios', price: 279.9, image: img('1706275399494-fb26bbc5da63'),
        description: 'Bateria portátil de 20.000 mAh em alumínio com saída USB-C de 30 W e duas portas USB-A. Carrega um smartphone até quatro vezes e permite ligar três aparelhos ao mesmo tempo.' },
    ],
  },
  {
    name: 'Casa Bella Decor',
    slug: 'casabella',
    domain: 'casabella.com',
    products: [
      { name: 'Sofá Retrátil Aurora 3 Lugares', category: 'Móveis', price: 3299, image: img('1484101403633-562f891dc89a'),
        description: 'Sofá retrátil e reclinável de 3 lugares em tecido suede cinza, assento com molas ensacadas e espuma D33 que não deforma. Largura de 2,30 m, profundidade aberto de 1,55 m e pés em madeira.' },
      { name: 'Poltrona Decorativa Nuvem', category: 'Móveis', price: 1290, image: img('1757969704802-4d0050f038d7'),
        description: 'Poltrona decorativa com encosto envolvente em tecido bouclé off-white e pés palito em madeira maciça. Assento em espuma D28, 75 cm de largura. Ideal para cantinho de leitura.' },
      { name: 'Mesa de Jantar Carvalho 6 Lugares', category: 'Móveis', price: 2490, image: img('1636138388621-258a72ecb07e'),
        description: 'Mesa de jantar retangular em madeira maciça de carvalho com acabamento natural fosco, 1,80 m x 0,90 m. Acomoda 6 pessoas com conforto e combina com cadeiras de madeira ou estofadas.' },
      { name: 'Cadeira de Escritório Ergonômica Flex', category: 'Móveis', price: 1190, image: img('1688578735352-9a6f2ac3b70a'),
        description: 'Cadeira de escritório com encosto em tela respirável, apoio lombar e de cabeça ajustáveis, braços 3D e mecanismo relax com trava. Base em alumínio com rodízios silenciosos, suporta até 120 kg.' },
      { name: 'Rack para TV Nórdico 1,60 m', category: 'Móveis', price: 899, image: img('1780042731953-15dd1b3b5f00'),
        description: 'Rack branco em MDF com duas portas de fechamento suave e nicho para aparelhos. 1,60 m de largura, comporta TVs de até 65 polegadas e tem passa-fios na parte de trás.' },
      { name: 'Luminária de Piso Arco', category: 'Iluminação', price: 649.9, image: img('1606425288528-4cebbfc69de7'),
        description: 'Luminária de piso estilo arco com cúpula em metal e base pesada que garante estabilidade. Altura de 1,90 m e alcance de 1,40 m: ilumina o sofá sem furar o teto. Soquete E27.' },
      { name: 'Pendente Cúpula Rattan', category: 'Iluminação', price: 329, image: img('1643509877015-c90830bb8519'),
        description: 'Luminária pendente artesanal em rattan natural, diâmetro de 30 cm e cabo ajustável até 1,20 m. A trama projeta sombras suaves; ideal para salas de jantar, cozinhas e varandas.' },
      { name: 'Abajur Cerâmica Texturizada', category: 'Iluminação', price: 219.9, image: img('1580130281320-0ef0754f2bf7'),
        description: 'Abajur com base de cerâmica texturizada em tom areia e cúpula de linho cru. Altura de 52 cm, luz difusa e aconchegante para criado-mudo ou aparador. Soquete E27.' },
      { name: 'Jogo de Cama Percal 400 Fios Queen', category: 'Cama, Mesa e Banho', price: 459, image: img('1688065177980-926d65bd548c'),
        description: 'Jogo de cama queen em 100% algodão percal 400 fios: lençol com elástico, lençol de cima e duas fronhas. Toque fresco e macio que melhora a cada lavagem. Cor branco.' },
      { name: 'Kit Toalhas Algodão Egípcio 4 Peças', category: 'Cama, Mesa e Banho', price: 289.9, image: img('1666934209606-a955a12edd63'),
        description: 'Kit com 2 toalhas de banho e 2 de rosto em algodão egípcio fio penteado, 600 g/m². Alta absorção, toque macio e secagem rápida. Cor branco.' },
      { name: 'Manta Tricô Chunky', category: 'Cama, Mesa e Banho', price: 259, image: img('1674475760738-8c7af859f821'),
        description: 'Manta em tricô de fio grosso, macia e encorpada, em tom off-white. 1,30 m x 1,60 m, perfeita para o braço do sofá ou o pé da cama nos dias frios.' },
      { name: 'Tapete Kilim Geométrico 2x3 m', category: 'Decoração', price: 789, image: img('1594040226829-7f251ab46d80'),
        description: 'Tapete kilim tecido à mão em lã e algodão, com estampa geométrica colorida. Dimensões de 2 x 3 m, dupla face e fácil de limpar. Dá personalidade à sala ou ao quarto.' },
      { name: 'Espelho Redondo Moldura Madeira 70 cm', category: 'Decoração', price: 399, image: img('1618220252344-8ec99ec624b1'),
        description: 'Espelho de parede redondo com 70 cm de diâmetro e moldura fina em madeira natural. Amplia e ilumina halls, salas e banheiros. Acompanha kit de fixação.' },
      { name: 'Vaso Decorativo Cerâmica Fosca', category: 'Decoração', price: 149.9, image: img('1612196808214-b8e1d6145a8c'),
        description: 'Vaso em cerâmica com acabamento fosco na cor off-white, 35 cm de altura. Ideal para galhos secos e arranjos; funciona sozinho ou em composição com outros vasos.' },
      { name: 'Kit Capas de Almofada 4 Peças', category: 'Decoração', price: 179.9, image: img('1592789705501-f9ae4278a9c9'),
        description: 'Kit com 4 capas de almofada 45 x 45 cm em tons de mostarda, preto e cru, com texturas de linho e tricô. Zíper invisível; refis vendidos separadamente.' },
      { name: 'Cesto Organizador Fibra Natural', category: 'Decoração', price: 129.9, image: img('1674591409662-55f4f2c55fff'),
        description: 'Cesto trançado à mão em fibra natural com alças, 40 cm de diâmetro. Organiza mantas, brinquedos e revistas, e funciona como cachepô para plantas grandes.' },
    ],
  },
];

async function seed() {
  await mongoose.connect(env.MONGO_URI);
  console.log(`🌱 Seeding ${mongoose.connection.name}…`);

  await Promise.all([
    ProductModel.deleteMany({}).setOptions({ skipTenantGuard: true }),
    ConversationModel.deleteMany({}).setOptions({ skipTenantGuard: true }),
    UserModel.deleteMany({}),
    CompanyModel.deleteMany({}),
  ]);
  await Promise.all([ProductModel.syncIndexes(), UserModel.syncIndexes(), CompanyModel.syncIndexes(), ConversationModel.syncIndexes()]);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const credentials: string[][] = [];

  for (const c of COMPANIES) {
    const company = await CompanyModel.create({ name: c.name, slug: c.slug });
    await UserModel.create([
      { name: `Admin ${c.name.split(' ')[0]}`, email: `admin@${c.domain}`, role: 'admin', passwordHash, company_id: company._id },
      { name: `Cliente ${c.name.split(' ')[0]}`, email: `user@${c.domain}`, role: 'user', passwordHash, company_id: company._id },
    ]);
    // create() rather than insertMany() so the searchText hook runs.
    await ProductModel.create(
      c.products.map(({ image, ...p }) => ({ ...p, imageUrl: image, company_id: company._id })),
    );
    console.log(`   ✔ ${c.name}: ${c.products.length} products`);
    credentials.push([c.name, `admin@${c.domain}`, 'admin'], [c.name, `user@${c.domain}`, 'user']);
  }

  console.log(`\n🔑 Credentials (password for all: ${PASSWORD})`);
  console.table(credentials.map(([company, email, role]) => ({ company, email, role })));
  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error('❌ Seed failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
