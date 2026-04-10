/**
 * JCTI 韭菜交易人格指标 — 极速单页版
 * 31 题 × 22 类型 × 守护大师 sprite
 */

// ═══════════════════════════════════════════════════════════════════
// DATA: 22 JCTI Types + Guardian Masters
// ═══════════════════════════════════════════════════════════════════

const JCTI_TYPES = [
  { code: 'HODL', name: '钻石手', nameEn: 'Diamond Hands', desc: '账户跌 90% 还在发朋友圈说"价值投资需要时间"', master: 'Warren Buffett', masterKey: 'warren_buffett', rarity: '传奇', rarityClass: 'legendary', archetype: '价值投资者', quote: 'Rule #1: Never lose money. Rule #2: Never forget Rule #1.', vector: [0,0,1, 0,0,0, 1,0,1, 0,0,0, 0,0,0] },
  { code: 'FOMO', name: '追高圣体', nameEn: 'The Chaser', desc: '精准买在每一个历史最高点，连庄家都佩服你的择时能力', master: 'Jesse Livermore', masterKey: 'jesse_livermore', rarity: '传奇', rarityClass: 'legendary', archetype: '趋势追踪者', quote: 'The market is never wrong, opinions are.', vector: [2,2,2, 2,2,2, 0,2,0, 2,2,1, 1,0,2] },
  { code: 'YOLO', name: '梭哈战神', nameEn: 'The All-Inner', desc: '人生只有两个状态：兰博基尼和兰州拉面', master: 'George Soros', masterKey: 'george_soros', rarity: '传奇', rarityClass: 'legendary', archetype: '宏观交易者', quote: "It's not whether you're right or wrong, but how much you make when right.", vector: [2,2,1, 2,1,2, 1,2,0, 2,2,2, 2,2,2] },
  { code: 'REKT', name: '爆仓艺术家', nameEn: 'The Liquidated', desc: '100 倍杠杆是一种生活美学，爆仓是行为艺术', master: '凉兮 Liangxi', masterKey: 'liangxi', rarity: '稀有', rarityClass: 'rare', archetype: '趋势追踪者', quote: '爆仓线就是我的加仓信号。', vector: [2,2,2, 2,2,2, 0,2,0, 2,2,2, 1,2,1] },
  { code: 'SELL', name: '卖飞教主', nameEn: 'The Paperhander', desc: '刚卖就涨停。你确定券商没在监控你的账户？', master: 'Nicolas Darvas', masterKey: 'nicolas_darvas', rarity: '罕见', rarityClass: 'uncommon', archetype: '趋势追踪者', quote: "I was never afraid of buying high. I was afraid of not cutting losses.", vector: [1,0,1, 1,0,1, 1,0,1, 1,0,0, 1,0,1] },
  { code: 'GURU', name: '马后炮', nameEn: 'The Hindsighter', desc: '事后分析起来比巴菲特都准，事前下单比菜鸟都烂', master: 'Charlie Munger', masterKey: 'charlie_munger', rarity: '史诗', rarityClass: 'epic', archetype: '价值投资者', quote: "All I want to know is where I'm going to die, so I'll never go there.", vector: [1,1,0, 0,1,0, 2,2,2, 1,0,0, 2,2,0] },
  { code: 'MOON', name: '暴富幻想家', nameEn: 'The Dreamer', desc: '还没开户就在研究迈巴赫选配了', master: 'Cathie Wood', masterKey: 'cathie_wood', rarity: '稀有', rarityClass: 'rare', archetype: '第一性原理', quote: 'Innovation compounds nonlinearly — bet on the curve, not the level.', vector: [1,2,2, 1,1,0, 0,1,0, 2,2,1, 2,1,2] },
  { code: 'LEEK', name: '韭皇大帝', nameEn: 'The Perma-Leek', desc: '被割了八茬还在说"这次不一样"。韭菜界的活化石', master: 'Isaac Newton', masterKey: 'isaac_newton', rarity: '稀有', rarityClass: 'rare', archetype: '科学家', quote: 'I can calculate the motion of heavenly bodies, but not the madness of people.', vector: [1,1,2, 1,2,1, 0,2,0, 2,1,1, 1,0,2] },
  { code: 'COPE', name: '精神胜利法', nameEn: 'The Copium Master', desc: '"亏的不是钱，是交了认知升级的学费"', master: 'Nassim Taleb', masterKey: 'nassim_taleb', rarity: '史诗', rarityClass: 'epic', archetype: '哲学家', quote: 'Wind extinguishes a candle and energizes fire. Be the fire.', vector: [2,1,1, 0,1,0, 1,2,0, 1,0,0, 2,2,0] },
  { code: 'DEAD', name: '装死大师', nameEn: 'The Possum', desc: '账户亏了就当它不存在。已读不回，股票也不回', master: '老子 Laozi', masterKey: 'laozi', rarity: '稀有', rarityClass: 'rare', archetype: '哲学家', quote: '上善若水。', vector: [0,0,0, 0,0,0, 1,0,0, 0,0,0, 0,0,0] },
  { code: 'PUMP', name: '喊单狂魔', nameEn: 'The Shiller', desc: '朋友圈永远在"抄底"，但从来没人见过收益截图', master: '孙宇晨 Justin Sun', masterKey: 'justin_sun', rarity: '普通', rarityClass: 'uncommon', archetype: '链上原住民', quote: 'Adoption beats elegance — distribution is the moat in crypto.', vector: [2,2,2, 2,1,2, 0,2,0, 2,1,1, 2,2,2] },
  { code: 'COPY', name: '抄作业天王', nameEn: 'The Copycat', desc: '别人买啥跟啥，就是永远晚一个涨停板', master: "William O'Neil", masterKey: 'william_oneil', rarity: '普通', rarityClass: 'common', archetype: '趋势追踪者', quote: 'Letting losses run is the most serious mistake.', vector: [1,1,1, 1,1,1, 0,1,0, 1,0,0, 0,0,2] },
  { code: 'NEWS', name: '消息面猎手', nameEn: 'The News Junkie', desc: '你炒新闻，新闻炒你。最后大家一起被套', master: 'Victor Sperandeo', masterKey: 'victor_sperandeo', rarity: '普通', rarityClass: 'uncommon', archetype: '宏观交易者', quote: 'A speculator who dies rich has died before his time.', vector: [1,1,2, 2,1,2, 2,1,1, 1,0,0, 1,0,1] },
  { code: 'WAIT', name: '永恒等待者', nameEn: 'The Eternal Waiter', desc: '"等回本就走"——三年前说的。现在还在等', master: 'Benjamin Graham', masterKey: 'benjamin_graham', rarity: '传奇', rarityClass: 'legendary', archetype: '价值投资者', quote: 'The essence of investment management is the management of risks.', vector: [0,0,0, 0,0,0, 1,0,1, 0,0,0, 0,1,0] },
  { code: 'RICH', name: '纸上富贵', nameEn: 'The Paper Rich', desc: '浮盈截图发了 30 条朋友圈，浮亏时朋友圈仅自己可见', master: 'Stanley Druckenmiller', masterKey: 'stanley_druckenmiller', rarity: '史诗', rarityClass: 'epic', archetype: '宏观交易者', quote: 'It takes courage to be a pig.', vector: [1,2,2, 1,1,1, 1,1,0, 2,1,0, 2,2,1] },
  { code: 'ALGO', name: '量化幻想家', nameEn: 'The Quant Wannabe', desc: '写了 200 行 Python 回测年化 300%，实盘第一天亏 15%', master: 'Jim Simons', masterKey: 'jim_simons', rarity: '传奇', rarityClass: 'legendary', archetype: '量化大师', quote: "We don't override the models. The model is the system.", vector: [0,0,0, 0,0,0, 2,0,2, 1,0,0, 0,2,0] },
  { code: 'SAFE', name: '余额宝战士', nameEn: 'The Ultra-Safe', desc: '研究了 500 篇研报，最后还是买了货币基金', master: 'Ray Dalio', masterKey: 'ray_dalio', rarity: '史诗', rarityClass: 'epic', archetype: '量化大师', quote: 'He who lives by the crystal ball will eat shattered glass.', vector: [0,0,0, 0,0,0, 2,0,2, 0,0,0, 0,1,0] },
  { code: 'RAGE', name: '报复性交易', nameEn: 'The Revenge Trader', desc: '亏了就加仓，加了就再亏，亏了再加。完美闭环', master: 'Paul Tudor Jones', masterKey: 'paul_tudor_jones', rarity: '史诗', rarityClass: 'epic', archetype: '宏观交易者', quote: 'Every day I assume every position I have is wrong.', vector: [2,2,2, 2,2,2, 0,2,0, 2,1,1, 0,0,1] },
  { code: 'WISE', name: '冷静哥', nameEn: 'The Zen Trader', desc: '别人恐惧你贪婪？不，别人恐惧你也恐惧，但你假装不恐惧', master: 'Seneca', masterKey: 'seneca', rarity: '稀有', rarityClass: 'rare', archetype: '哲学家', quote: 'The whole future lies in uncertainty: live immediately.', vector: [0,1,0, 0,0,0, 2,0,2, 0,0,0, 0,2,0] },
  { code: 'DEBT', name: '借钱炒股侠', nameEn: 'The Leveraged Life', desc: '花呗借呗都变成了保证金，但觉得自己风控很好', master: 'Sam Bankman-Fried', masterKey: 'sbf', rarity: '普通', rarityClass: 'uncommon', archetype: '链上原住民', quote: 'When the books and the trades live in the same hands, the books eventually lose.', vector: [2,2,2, 2,2,2, 0,2,0, 2,2,2, 0,0,1] },
  { code: 'WINE', name: '醉酒操盘手', nameEn: 'The Drunk Trader', desc: '喝多了打开交易软件，第二天醒来看持仓：？？？', master: 'Arthur Hayes', masterKey: 'arthur_hayes', rarity: '普通', rarityClass: 'uncommon', archetype: '链上原住民', quote: 'The only winning move against central banks is to buy hard assets.', vector: [2,2,2, 2,0,1, 0,1,0, 2,2,1, 1,1,1] },
  { code: 'LUCK', name: '玄学操盘手', nameEn: 'The Mystic', desc: '你的交易逻辑超出了人类认知。也许你应该去买彩票', master: 'Satoshi Nakamoto', masterKey: 'satoshi_nakamoto', rarity: '传奇', rarityClass: 'legendary', archetype: '链上原住民', quote: "If you don't believe me or don't get it, I don't have time to convince you.", vector: [1,1,1, 1,1,1, 1,1,1, 1,1,1, 1,1,1] },
];

// ═══════════════════════════════════════════════════════════════════
// DATA: 31 Questions
// ═══════════════════════════════════════════════════════════════════

const QUESTIONS = [
  // ─── M1 抗压 ×2 ───
  { id:1, dim:'M1', text:'你买的股票跌了 20%，你的第一反应是：', options:[
    {text:'打开外卖软件点了杯奶茶安慰自己', value:'M'},
    {text:'加仓！越跌越买！地板价啊兄弟！', value:'H'},
    {text:'关掉 APP 假装什么都没发生', value:'L'},
    {text:'打电话问客服能不能退货', value:'L'},
  ]},
  { id:2, dim:'M1', text:'你的持仓突然暴跌 30%，你打开手机的顺序是：', options:[
    {text:'先看微博热搜，确认不是只有我亏', value:'M'},
    {text:'直接挂单补仓，跌多了就是机会', value:'H'},
    {text:'把交易 APP 拖到最后一页文件夹里', value:'L'},
  ]},
  // ─── M2 得意 ×2 ───
  { id:3, dim:'M2', text:'你的股票涨了 50%，你会：', options:[
    {text:'立刻卖了落袋为安', value:'L'},
    {text:'加仓！这才刚开始！', value:'H'},
    {text:'截图发朋友圈，配文"运气好"', value:'M'},
    {text:'告诉老婆/男朋友，然后被没收手机', value:'M'},
  ]},
  { id:4, dim:'M2', text:'某个币一晚上涨了 10 倍，而你昨天刚卖了：', options:[
    {text:'"赚到了就好，不贪"（内心在滴血）', value:'M'},
    {text:'立刻追回去买入，10 倍算什么', value:'H'},
    {text:'发了条朋友圈："投资要理性"（配图是哭泣猫头）', value:'M'},
    {text:'安慰自己：下次一定，然后去喝闷酒', value:'L'},
  ]},
  // ─── M3 情绪周期 ×2 ───
  { id:5, dim:'M3', text:'大盘连跌三天，你的心情变化是：', options:[
    {text:'跟 K 线完全同步，红了开心绿了抑郁', value:'H'},
    {text:'有点烦但不影响吃饭睡觉', value:'M'},
    {text:'看都不看，涨跌跟我有什么关系', value:'L'},
  ]},
  { id:6, dim:'M3', text:'你的交易心态最像哪种动物？', options:[
    {text:'过山车上的仓鼠——随市场尖叫', value:'H'},
    {text:'观望中的猫头鹰——偶尔关注', value:'M'},
    {text:'冬眠的熊——买完就忘了账户密码', value:'L'},
  ]},
  // ─── A1 决策速度 ×2 ───
  { id:7, dim:'A1', text:'朋友跟你说了一只"内幕消息"的股票，你会：', options:[
    {text:'秒开交易软件直接买入', value:'H'},
    {text:'先百度一下这公司是干嘛的', value:'M'},
    {text:'研究三天三夜，研究完发现已经涨了 30%', value:'L'},
    {text:'跟另外十个朋友确认一下是不是真的', value:'M'},
  ]},
  { id:8, dim:'A1', text:'你看到一个新上线的 DeFi 项目 APY 写着 9999%，你：', options:[
    {text:'已经在连钱包了，你说什么？', value:'H'},
    {text:'先去查查审计报告和团队背景', value:'M'},
    {text:'关闭浏览器，打开余额宝看看收益', value:'L'},
  ]},
  // ─── A2 止损纪律 ×2 ───
  { id:9, dim:'A2', text:'你设了 10% 止损线，到了之后你会：', options:[
    {text:'严格执行，纪律是纪律', value:'L'},
    {text:'再等等，也许明天就反弹了', value:'M'},
    {text:'把止损线改成 20%（问题解决了）', value:'H'},
    {text:'什么止损线？我不知道这个功能', value:'H'},
  ]},
  { id:10, dim:'A2', text:'你挂的止损单被触发了，然后股价立刻反弹：', options:[
    {text:'纪律执行没问题，下次再来', value:'L'},
    {text:'气到把止损功能关了："再也不用这破东西"', value:'H'},
    {text:'在心里骂了十分钟庄家，然后重新买入', value:'M'},
  ]},
  // ─── A3 操作频率 ×2 ───
  { id:11, dim:'A3', text:'你打开交易软件的频率是：', options:[
    {text:'一天看 50 次，包括上厕所的时候', value:'H'},
    {text:'每天看一两次，了解个大概', value:'M'},
    {text:'上次登录密码都忘了', value:'L'},
  ]},
  { id:12, dim:'A3', text:'如果手机没电了，你最着急的是：', options:[
    {text:'不能看盘！万一错过行情！', value:'H'},
    {text:'不能刷社交媒体了', value:'M'},
    {text:'终于可以安静一会儿了', value:'L'},
  ]},
  // ─── C1 信息来源 ×2 ───
  { id:13, dim:'C1', text:'你的投资决策主要依据是：', options:[
    {text:'自己看 K 线、读财报、做模型', value:'L'},
    {text:'跟几个大 V 和 KOL 的推荐', value:'M'},
    {text:'群里有人喊"冲"就冲', value:'H'},
  ]},
  { id:14, dim:'C1', text:'关于"技术分析"，你的看法是：', options:[
    {text:'MACD 金叉死叉、布林带我都会', value:'L'},
    {text:'听说过，但主要还是看消息面', value:'M'},
    {text:'技术分析是什么？直觉就是最好的指标', value:'H'},
  ]},
  // ─── C2 归因方式 ×2 ───
  { id:15, dim:'C2', text:'你亏钱了，最先怪谁：', options:[
    {text:'怪自己，技术不行', value:'L'},
    {text:'怪那个给我推荐的朋友', value:'M'},
    {text:'怪庄家操纵市场', value:'H'},
    {text:'怪美联储/怪政策/怪天气/怪水逆', value:'H'},
  ]},
  { id:16, dim:'C2', text:'你买的股票跌停了，你的第一句话是：', options:[
    {text:'"我的判断有误，需要复盘"', value:'L'},
    {text:'"都是XX基金经理的锅"', value:'M'},
    {text:'"这个市场就是个赌场，全是黑幕"', value:'H'},
  ]},
  // ─── C3 学习意愿 ×2 ───
  { id:17, dim:'C3', text:'亏了一笔大的之后，你会：', options:[
    {text:'认真复盘写交易日志，下次避免', value:'L'},
    {text:'痛定思痛三天，然后继续犯同样的错', value:'M'},
    {text:'"不用学，我只是运气不好"', value:'H'},
  ]},
  { id:18, dim:'C3', text:'有人推荐你看一本投资经典书籍：', options:[
    {text:'买了，认真读了，做了笔记', value:'L'},
    {text:'加了购物车，等双十一打折再说', value:'M'},
    {text:'"读书不如实战，亏钱就是最好的老师"', value:'H'},
  ]},
  // ─── D1 收益预期 ×2 ───
  { id:19, dim:'D1', text:'你理想中的年化收益率是：', options:[
    {text:'跑赢余额宝就行，本金安全最重要', value:'L'},
    {text:'20%-30%，稳健增长', value:'M'},
    {text:'翻倍起步，不然炒什么股', value:'H'},
    {text:'财务自由，这辈子不用再上班', value:'H'},
  ]},
  { id:20, dim:'D1', text:'别人问你投资目标是什么，你说：', options:[
    {text:'"保本就好，稳稳的幸福"', value:'L'},
    {text:'"争取跑赢通胀"', value:'M'},
    {text:'"十年十倍"', value:'H'},
    {text:'"下一个巴菲特"（账户余额 500 块）', value:'H'},
  ]},
  // ─── D2 杠杆态度 ×2 ───
  { id:21, dim:'D2', text:'关于杠杆/合约交易，你的态度是：', options:[
    {text:'绝对不碰，本金安全第一', value:'L'},
    {text:'偶尔小杠杆，增加点刺激', value:'M'},
    {text:'100 倍杠杆才有感觉，不然没意思', value:'H'},
  ]},
  { id:22, dim:'D2', text:'你的朋友用 50 倍杠杆赚了 10 万，你：', options:[
    {text:'"挺好的，但我不会这么做"', value:'L'},
    {text:'"教教我？小玩一下应该没事"', value:'M'},
    {text:'"才 50 倍？给我来 125 倍的"', value:'H'},
  ]},
  // ─── D3 本金来源 ×2 ───
  { id:23, dim:'D3', text:'你用来投资的钱是：', options:[
    {text:'闲钱，亏光了也不影响生活', value:'L'},
    {text:'工资的一部分，有点肉疼但能承受', value:'M'},
    {text:'信用卡套现 + 借呗 + 问朋友借的', value:'H'},
  ]},
  { id:24, dim:'D3', text:'你的投资账户占你总资产的比例是：', options:[
    {text:'10% 以下，大部分存定期', value:'L'},
    {text:'30%-50%，合理配置', value:'M'},
    {text:'90% 以上，All in 才是信仰', value:'H'},
  ]},
  // ─── S1 分享欲 ×2 ───
  { id:25, dim:'S1', text:'关于你的投资成绩，你朋友圈的画风是：', options:[
    {text:'赚了：年化收益截图。亏了：今天天气真好', value:'M'},
    {text:'赚了亏了都不发，闷声发大财/闷声亏大钱', value:'L'},
    {text:'赚了发，亏了也发，人生需要真实', value:'H'},
    {text:'从不发投资相关。我怕亲戚找我借钱', value:'L'},
  ]},
  { id:26, dim:'S1', text:'你赚了一笔大的，第一时间会：', options:[
    {text:'谁都不说，默默加菜', value:'L'},
    {text:'发个含蓄的朋友圈暗示一下', value:'M'},
    {text:'群里 @所有人："跟上了吗兄弟们？"', value:'H'},
  ]},
  // ─── S2 影响力 ×2 ───
  { id:27, dim:'S2', text:'在投资这件事上，你通常的角色是：', options:[
    {text:'给别人分析大盘走势的"民间股神"', value:'H'},
    {text:'听各方意见然后自己判断', value:'M'},
    {text:'谁的建议都不听，我行我素', value:'L'},
  ]},
  { id:28, dim:'S2', text:'群里有人问"XX 股票能买吗"，你：', options:[
    {text:'洋洋洒洒写了一篇分析报告', value:'H'},
    {text:'"我也在看，一起研究"', value:'M'},
    {text:'"别问我，我自己都亏着呢"', value:'L'},
  ]},
  // ─── S3 群体行为 ×2 ───
  { id:29, dim:'S3', text:'全网都在说"牛市来了"，你会：', options:[
    {text:'别人贪婪我恐惧（嘴上说说，身体很诚实地买入了）', value:'M'},
    {text:'冲！怎么能错过这波！', value:'H'},
    {text:'观望，等他们先亏', value:'L'},
    {text:'发一条朋友圈分析为什么是假牛市（然后偷偷建仓）', value:'M'},
  ]},
  { id:30, dim:'S3', text:'你身边 5 个朋友都在买同一只股票，你：', options:[
    {text:'"这么多人买肯定没错，我也买！"', value:'H'},
    {text:'先看看再说，但心里痒痒的', value:'M'},
    {text:'"大家都买？那肯定要跌了"', value:'L'},
  ]},
  // ─── Q31: 隐藏触发题 ───
  { id:31, dim:'HIDDEN', text:'你一般在什么状态下做交易决策最果断？', options:[
    {text:'早上精神好的时候', value:'L'},
    {text:'深夜一个人安静分析的时候', value:'M'},
    {text:'上班摸鱼的时候', value:'M'},
    {text:'喝了酒之后特别有灵感', value:'H', triggersWine: true},
  ]},
];

// dimension → stat label mapping
const DIM_TO_STAT = {
  M: { label: '耐心', index: 0 },
  A: { label: '魄力', index: 1 },
  C: { label: '精准', index: 2 },
  D: { label: '野心', index: 3 },
  S: { label: '智慧', index: 4 },
};

const STAT_LABELS = ['耐心', '魄力', '精准', '野心', '智慧'];
const VALUE_MAP = { L: 0, M: 1, H: 2 };

// ═══════════════════════════════════════════════════════════════════
// SCORING ENGINE
// ═══════════════════════════════════════════════════════════════════

function computeUserVector(answers) {
  // answers: array of { dim, value } for each answered question
  // Build 15-dim vector from sub-dimension averages
  const subs = {};
  for (const a of answers) {
    if (a.dim === 'HIDDEN') continue;
    if (!subs[a.dim]) subs[a.dim] = [];
    subs[a.dim].push(VALUE_MAP[a.value]);
  }
  // Order: M1,M2,M3, A1,A2,A3, C1,C2,C3, D1,D2,D3, S1,S2,S3
  const order = ['M1','M2','M3','A1','A2','A3','C1','C2','C3','D1','D2','D3','S1','S2','S3'];
  return order.map(d => {
    const vals = subs[d] || [1];
    return vals.reduce((a,b) => a+b, 0) / vals.length;
  });
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function computeDimensionScores(userVector) {
  // 5 dimensions, each is average of 3 sub-dims, scaled to 0-100
  const scores = [];
  for (let d = 0; d < 5; d++) {
    const avg = (userVector[d*3] + userVector[d*3+1] + userVector[d*3+2]) / 3;
    scores.push(Math.round(avg / 2 * 100));
  }
  return scores;
}

function matchType(answers) {
  // Check WINE trigger
  const wineAnswer = answers.find(a => a.triggersWine);
  if (wineAnswer) return { type: JCTI_TYPES.find(t => t.code === 'WINE'), similarity: 100, matchedDims: 15, userVec: computeUserVector(answers) };

  const userVec = computeUserVector(answers);
  let bestType = null, bestSim = -1;
  for (const t of JCTI_TYPES) {
    if (t.code === 'WINE' || t.code === 'LUCK') continue;
    const sim = cosineSimilarity(userVec, t.vector);
    if (sim > bestSim) { bestSim = sim; bestType = t; }
  }

  // Floor at 0; upper bound guaranteed by cosine similarity on non-negative vectors
  const simPct = Math.max(0, Math.round(bestSim * 100));

  // LUCK fallback
  if (bestSim < 0.6) {
    return { type: JCTI_TYPES.find(t => t.code === 'LUCK'), similarity: simPct, matchedDims: 0, userVec };
  }

  // Count matched dimensions
  const matched = userVec.reduce((count, val, i) => {
    return count + (Math.abs(val - bestType.vector[i]) <= 0.5 ? 1 : 0);
  }, 0);

  return { type: bestType, similarity: simPct, matchedDims: matched, userVec };
}

// ═══════════════════════════════════════════════════════════════════
// SUPABASE
// ═══════════════════════════════════════════════════════════════════

const SUPABASE_URL = 'https://kqireoahumqqswwotcxj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxaXJlb2FodW1xcXN3d290Y3hqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MDE5MzIsImV4cCI6MjA5MTM3NzkzMn0.Z4udh1aEzemEA5POeD7iDV22hgYdyFreWbrxeAhoWys';

function submitResult(result, dimScores) {
  const t = result.type;
  fetch(SUPABASE_URL + '/rest/v1/jcti_results', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      jcti_type: t.code,
      type_name: t.name,
      similarity: result.similarity,
      matched_dims: result.matchedDims,
      dimension_scores: Object.fromEntries(STAT_LABELS.map((l, i) => [l, dimScores[i]])),
      user_vector: result.userVec,
      answers: answers.map(a => ({ dim: a.dim, value: a.value })),
    }),
  }).catch(() => {}); // silent — never break UX
}

function showStats() {
  showScreen('stats');
  document.getElementById('stats-loading').style.display = '';
  document.getElementById('stats-content').style.display = 'none';

  fetch(SUPABASE_URL + '/rest/v1/rpc/jcti_stats', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    },
  })
    .then(r => r.json())
    .then(renderStats)
    .catch(() => {
      document.getElementById('stats-loading').textContent = '加载失败，请稍后重试';
    });
}

function renderStats(data) {
  document.getElementById('stats-loading').style.display = 'none';
  document.getElementById('stats-content').style.display = '';

  // KPIs
  document.getElementById('kpi-total').textContent = (data.total || 0).toLocaleString();
  document.getElementById('kpi-24h').textContent = '+' + (data.recent_count_24h || 0);

  // Type ranking
  const types = data.type_distribution || [];
  const maxCount = types.length ? types[0].count : 1;
  const rankEl = document.getElementById('type-ranking');
  rankEl.innerHTML = types.map((t, i) => {
    const pct = data.total ? Math.round(t.count / data.total * 100) : 0;
    const barW = Math.round(t.count / maxCount * 100);
    return `<div class="rank-row">
      <span class="rank-pos">${i + 1}</span>
      <span class="rank-code">${t.jcti_type}</span>
      <span class="rank-name">${t.type_name}</span>
      <div class="rank-bar-wrap"><div class="rank-bar" style="width:0%"  data-w="${barW}"></div></div>
      <span class="rank-pct">${pct}%</span>
    </div>`;
  }).join('');

  // Animate bars
  setTimeout(() => {
    rankEl.querySelectorAll('.rank-bar').forEach(bar => {
      bar.style.width = bar.dataset.w + '%';
    });
  }, 50);

  // Average DNA
  const avgEl = document.getElementById('avg-dna');
  const scores = data.avg_scores || {};
  avgEl.innerHTML = STAT_LABELS.map(label => {
    const val = scores[label] || 0;
    const colorClass = val >= 70 ? '' : val >= 40 ? 'mid' : 'low';
    return `<div class="stat-row">
      <span class="stat-label">${label}</span>
      <div class="stat-bar"><div class="stat-fill ${colorClass}" style="width:0%" data-w="${val}"></div></div>
      <span class="stat-value">${val}%</span>
    </div>`;
  }).join('');

  setTimeout(() => {
    avgEl.querySelectorAll('.stat-fill').forEach(bar => {
      bar.style.width = bar.dataset.w + '%';
    });
  }, 50);
}

// ═══════════════════════════════════════════════════════════════════
// UI STATE MACHINE
// ═══════════════════════════════════════════════════════════════════

let currentQuestion = 0;
let answers = [];

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

function startQuiz() {
  currentQuestion = 0;
  answers = [];
  showScreen('quiz');
  renderQuestion();
}

function renderQuestion() {
  const q = QUESTIONS[currentQuestion];
  const total = QUESTIONS.length;

  document.getElementById('progress-fill').style.width = ((currentQuestion + 1) / total * 100) + '%';
  document.getElementById('progress-label').textContent = (currentQuestion + 1) + ' / ' + total;

  const dimLabel = q.dim === 'HIDDEN' ? '???' : q.dim;
  document.getElementById('question-dim').textContent = dimLabel;
  document.getElementById('question-text').textContent = q.text;

  const optionsEl = document.getElementById('options');
  optionsEl.innerHTML = '';

  const letters = ['A', 'B', 'C', 'D'];
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = '<span class="letter">' + letters[i] + '.</span> ' + opt.text;
    btn.onclick = () => selectOption(opt);
    optionsEl.appendChild(btn);
  });

  // Re-trigger animation
  const area = document.getElementById('question-area');
  area.style.animation = 'none';
  area.offsetHeight; // force reflow
  area.style.animation = 'fadeIn 0.3s ease';
}

function selectOption(opt) {
  const q = QUESTIONS[currentQuestion];
  answers.push({ dim: q.dim, value: opt.value, triggersWine: opt.triggersWine || false });

  currentQuestion++;
  if (currentQuestion < QUESTIONS.length) {
    renderQuestion();
  } else {
    showResult();
  }
}

function showResult() {
  const result = matchType(answers);
  const t = result.type;
  const dimScores = computeDimensionScores(result.userVec);

  document.getElementById('result-code').textContent = '[ ' + t.code + ' ]';
  document.getElementById('result-name-cn').textContent = t.name;
  document.getElementById('result-name-en').textContent = t.nameEn;
  document.getElementById('result-desc').textContent = '"' + t.desc + '"';

  // Guardian
  document.getElementById('guardian-sprite').src = 'sprites/' + t.masterKey + '-idle.png';
  document.getElementById('guardian-sprite').alt = t.master;
  document.getElementById('guardian-name').textContent = t.master;

  const rarityEl = document.getElementById('guardian-rarity');
  rarityEl.textContent = (t.rarity === '传奇' ? '★★★★★' : t.rarity === '史诗' ? '★★★★' : t.rarity === '稀有' ? '★★★' : t.rarity === '普通' ? '★★' : '★') + ' ' + t.rarity + '级';
  rarityEl.className = 'guardian-rarity ' + t.rarityClass;

  document.getElementById('guardian-archetype').textContent = t.archetype;
  document.getElementById('guardian-quote').textContent = '"' + t.quote + '"';

  // Stats bars (batch DOM write to avoid reflow per iteration)
  const statsEl = document.getElementById('stats');
  let statsHtml = '';
  STAT_LABELS.forEach((label, i) => {
    const pct = dimScores[i];
    const colorClass = pct >= 70 ? '' : pct >= 40 ? 'mid' : 'low';
    statsHtml += `
      <div class="stat-row">
        <span class="stat-label">${label}</span>
        <div class="stat-bar"><div class="stat-fill ${colorClass}" style="width: 0%"></div></div>
        <span class="stat-value">${pct}%</span>
      </div>`;
  });
  statsEl.innerHTML = statsHtml;

  // Animate bars after render
  setTimeout(() => {
    statsEl.querySelectorAll('.stat-fill').forEach((bar, i) => {
      bar.style.width = dimScores[i] + '%';
    });
  }, 100);

  document.getElementById('result-similarity').textContent =
    '相似度 ' + result.similarity + '% · 命中 ' + result.matchedDims + '/15 维度';

  submitResult(result, dimScores);
  showScreen('result');
}

function resetQuiz() {
  showScreen('home');
}
