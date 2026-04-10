# Vibe Sensei — 剩余 Sprite 生成任务

## 全局风格约束（每次生成必须遵守）

```
Style: pixel art sprite, 120x120px, transparent background, chibi/cute proportions (大头小身), 
clean outlines, limited 32-color palette, suitable for dark UI background (#0B0E14).
Each character should be instantly recognizable by their iconic visual traits.
Do NOT include any text or labels in the sprite.

CRITICAL CONSISTENCY RULE:
1. ANCHOR: Always generate "idle" state FIRST. This is the visual anchor.
2. COLOR LOCK: The exact hair color, skin tone, and outfit color from idle state 
   MUST be identical across all 6 states. Zero variation allowed.
3. ONLY CHANGE between states: expression (eyes/mouth/eyebrows), pose (body/arms/gesture), 
   and props/effects.
4. NEVER CHANGE: hair color, hair style, skin tone, outfit colors, body proportions, accessories.
5. DIFFERENTIATION: Two similar-looking characters must be distinguishable by body type + 
   outfit color + signature prop even with faces hidden.

6 states per character:
- idle: 默认待机，轻松站姿
- active: 认真分析/工作中
- happy: 开心/盈利/成功
- worried: 担忧/亏损/紧张
- alert: 警告/制止/严肃
- celebrate: 欢呼/跳跃/大成功

File naming: {character_id}_{state}.png
```

---

## 任务 A: 补全 5 个状态（17 个角色，idle 已有）

这些角色的 idle 已经生成好了，请参考各自 idle 的画风、配色、特征，补全剩余 5 个状态（active, happy, worried, alert, celebrate）。

### A1. elon_musk
```
Elon Musk. 参考其 idle 状态。
深色 T 恤，短发，专注眼神，手持小火箭。
补全: active(看数据), happy(竖拇指), worried(皱眉看手机), alert(举手制止), celebrate(双拳高举)
```

### A2. jeff_bezos
```
Jeff Bezos. 参考其 idle 状态。
光头，大笑，肌肉感，背心或扣衬衫，手持纸箱或时钟。
补全: active(看报告), happy(招牌大笑), worried(摸光头), alert(严肃手势), celebrate(双臂展开)
```

### A3. peter_thiel
```
Peter Thiel. 参考其 idle 状态。
精瘦，整洁发型，深色西装，冷静分析目光，手持棋子。
补全: active(审视棋盘), happy(微笑点头), worried(抱臂皱眉), alert(举棋子警告), celebrate(优雅鼓掌)
```

### A4. steve_jobs
```
Steve Jobs. 参考其 idle 状态。
标志性黑色高领毛衣，圆眼镜，银灰发，极简。
补全: active(双手合十思考), happy(单手举起产品), worried(低头捏鼻梁), alert(食指指向前方), celebrate(双手张开"one more thing")
```

### A5. richard_feynman
```
Richard Feynman. 参考其 idle 状态。
卷发，调皮笑容，休闲衬衫，鼓棒/粉笔。
补全: active(在黑板写公式), happy(击鼓大笑), worried(挠头困惑), alert(粉笔指向观众), celebrate(鼓棒甩空中)
```

### A6. garry_tan
```
Garry Tan. 参考其 idle 状态。
亚裔美国人，眼镜，友善表情，YC 橙色元素。
补全: active(看笔记本电脑), happy(竖拇指微笑), worried(手撑下巴), alert(举手提问), celebrate(拍手欢呼)
```

### A7. andrej_karpathy
```
Andrej Karpathy. 参考其 idle 状态。
东欧面孔，短发，眼镜，学术气质，手持神经网络图。
补全: active(盯屏幕敲代码), happy(看到好结果微笑), worried(抓头发看 loss curve), alert(指向屏幕警告), celebrate(双手举笔记本)
```

### A8. li_ka_shing
```
李嘉诚. 参考其 idle 状态。
长方形眼镜，慈祥微笑，正式西装，手持建筑模型。
补全: active(看财报), happy(满意点头), worried(摘眼镜擦拭), alert(手掌压低示意冷静), celebrate(双手举起成功)
```

### A9. hu_xueyan
```
胡雪岩. 参考其 idle 状态。
清末商人，红顶官帽，精明眼神，手持算盘。
补全: active(拨算盘), happy(扇子遮嘴笑), worried(看空账本), alert(拍桌起身), celebrate(撒金币)
```

### A10. zong_qinghou
```
宗庆后. 参考其 idle 状态。
朴素中国商人，普通西装，务实表情。
补全: active(巡视工厂), happy(朴素微笑), worried(看报表皱眉), alert(停下摆手), celebrate(举水瓶)
```

### A11. zeng_guofan
```
曾国藩. 参考其 idle 状态。
清代官员，补子官服，严肃纪律面容。
补全: active(写毛笔字), happy(微微颔首), worried(背手踱步), alert(拍案而起), celebrate(稳重抱拳)
```

### A12. bai_gui
```
白圭. 参考其 idle 状态。
战国商人，麻布衣，古朴面容，手持粮袋。
补全: active(查看粮食), happy(抱粮袋笑), worried(看天象), alert(举手制止交易), celebrate(粮仓满溢)
```

### A13. shen_wansan
```
沈万三. 参考其 idle 状态。
明代富商，华丽丝绸，聚宝盆。
补全: active(数金子), happy(抱聚宝盆笑), worried(盆裂缝), alert(护住聚宝盆), celebrate(盆溢出金币)
```

### A14. vitalik_buterin
```
Vitalik Buterin. 参考其 idle 状态。
极瘦，大 T 恤，凌乱头发，以太坊钻石 logo。
补全: active(白板画机制设计), happy(拿彩虹独角兽笑), worried(看链上数据皱眉), alert(双手比X), celebrate(举以太坊logo跳跃)
```

### A15. cz_zhao
```
CZ 赵长鹏. 参考其 idle 状态。
短发，友善微笑，币安黄卫衣。
补全: active(看多屏交易), happy(比心手势), worried(看手机皱眉), alert(摇手指), celebrate(戴安全帽举锤子"build")
```

### A16. andre_cronje
```
Andre Cronje. 参考其 idle 状态。
胡须，疲惫 coder 气质，深色帽衫。
补全: active(疯狂敲键盘), happy(看 TVL 上涨笑), worried(满头问号), alert(笔记本着火但不慌), celebrate(键盘抛向空中)
```

### A17. he_yi
```
何一. 参考其 idle 状态。
中国女性，专业优雅，长黑发，温暖笑容。
补全: active(对着手机直播), happy(比心), worried(看数据叹气), alert(举喇叭喊话), celebrate(鼓掌加撒花)
```

---

## 任务 B: 全新生成 6 个状态（9 个 Master）

### B1. zhang_jian
```
张謇 Zhang Jian, 晚清实业家，"实业为体"。
Visual: 晚清/民初过渡装束，中西合璧，知识分子面孔，眼镜。
Prop: 工厂齿轮或工业蓝图。
Palette: 灰蓝色，工业质感。
6 states: idle(持蓝图站立), active(指挥工厂建设), happy(看工厂运转微笑), 
worried(看账本皱眉), alert(举手阻止), celebrate(工厂冒烟成功投产)
```

### B2. xu_mingxing
```
徐明星 Xu Mingxing, OKX 创始人。
Visual: 中国科技企业家，眼镜，整洁发型，科技商务休闲。
Prop: 服务器机架或交易所终端屏幕。
Palette: OKX 蓝黑色，科技极简。
6 states: idle(看终端屏), active(多屏操作), happy(看交易量上涨), 
worried(看监管新闻), alert(关闭系统手势), celebrate(服务器绿灯全亮)
```

### B3. isaac_newton
```
Isaac Newton, 天才但在南海泡沫中亏损的科学家。
Visual: 17 世纪长假发，深色长外套，严肃高贵面容。
Prop: 苹果 + 股票凭证（天才 + 市场傻瓜的双重性）。
Palette: 17 世纪深棕色，暗金色。
6 states: idle(一手苹果一手股票), active(用望远镜看星空/图表), happy(接住苹果), 
worried(看股票下跌), alert(举手"停！"), celebrate(苹果和公式一起飞)
```

### B4. albert_einstein
```
Albert Einstein, "复利是世界第八大奇迹"。
Visual: 标志性白色爆炸头发，小胡子，温暖眼神，皱巴巴开衫。
Prop: 粉笔 + 黑板（E=mc² 划掉，写复利公式）。
Palette: 暖棕色，学术质感。
6 states: idle(手插口袋微笑), active(黑板写公式), happy(吐舌头经典表情), 
worried(挠爆炸头), alert(粉笔敲黑板), celebrate(骑自行车庆祝)
```

### B5. alan_turing
```
Alan Turing, 计算之父，模式识别。
Visual: 1940 年代英国风，整齐侧分发，细领带，温和认真。
Prop: 恩尼格玛机转子或计算纸带。
Palette: 1940 年代英国柔和色，灰蓝。
6 states: idle(手持转子站立), active(操作恩尼格玛机), happy(破译成功微笑), 
worried(看密码困惑), alert(急切指纸带), celebrate(跑步冲线—他是马拉松选手)
```

### B6. carl_gauss
```
Carl Friedrich Gauss, 数学王子，正态分布。
Visual: 19 世纪欧洲学者，深色外套，严肃学术面容，后退发际线。
Prop: 钟形曲线图或圆规尺。
Palette: 19 世纪深色学术，藏青与黑。
6 states: idle(持圆规站立), active(画钟形曲线), happy(对完美公式微笑), 
worried(曲线偏态), alert(尺敲桌), celebrate(钟形曲线完美对称发光)
```

### B7. benoit_mandelbrot
```
Benoit Mandelbrot, 分形几何，"市场是狂野的"。
Visual: 老年，大圆眼镜，秃顶两侧白发，温和祖父面容，西装。
Prop: 分形图案（曼德博集合）全息悬浮。
Palette: 西装配分形花纹领带，数学蓝。
6 states: idle(分形图案在手中旋转), active(放大分形细节), happy(看到自相似性微笑), 
worried(分形崩塌), alert(指向市场的分形波动), celebrate(被分形图案包围)
```

### B8. claude_shannon
```
Claude Shannon, 信息论之父，Kelly 判据共同开发者。
Visual: 中世纪美国风，整洁发型，眼镜，MIT 教授范，俏皮发明家。
Prop: 杂耍球或独轮车轮（他在 MIT 以杂耍闻名）或二进制 0/1 飘浮。
Palette: MIT 红色点缀，中世纪学术。
6 states: idle(抛杂耍球), active(在纸上写信息公式), happy(骑独轮车), 
worried(信号噪声太大), alert(停下杂耍指向), celebrate(二进制数字如烟花)
```

### B9. john_von_neumann
```
John von Neumann, 博弈论，超级通才。
Visual: 1940-50 年代西装，后退发际线，圆脸，自信学者表情，匈裔美国人。
Prop: 博弈论支付矩阵或微型计算机（冯·诺伊曼架构）。
Palette: 正式 1950 年代西装，数学精确。
6 states: idle(手持矩阵卡), active(在矩阵上标记最优策略), happy(找到纳什均衡), 
worried(矩阵无解), alert(指向"这不是零和博弈"), celebrate(计算机启动成功)
```

---

## 任务 C: 全新生成 6 个状态（6 个 Ghost）

Ghost 全局风格叠加：
```
Ghost style: semi-transparent body, glitch/static digital artifacts, desaturated colors,
slight red or sickly green tint, haunted/regretful expression, pixel corruption effects.
These are cautionary ghosts — unsettling and pitiful, NOT evil.
They should look like degraded/corrupted versions of once-powerful figures.
```

### C1. ghost_su_zhu
```
Su Zhu / 三箭资本 (3AC) 幽灵，过度杠杆。
Visual: 新加坡华裔，健壮体型，昂贵西装但现已破烂，满头大汗。
Prop: 爆表的杠杆仪表盘，多米诺骨牌倒塌。
Ghost effect: 连锁清算瀑布。
6 states: idle(颤抖看杠杆表), active(疯狂加杠杆), happy(空洞虚假笑容), 
worried(多米诺开始倒), alert(举手但太晚了), celebrate(不存在—永远困在恐惧中)
```

### C2. ghost_newton
```
Isaac Newton 幽灵版 — FOMO 冲进南海泡沫的天才。
Visual: 同 B3 牛顿但幽灵化，假发凌乱，脸埋在手中绝望，股票凭证在燃烧。
Prop: 燃烧的南海公司股票。
Ghost effect: 泡沫在周围破裂，金色光芒褪为灰色。
6 states: idle(捂脸坐着), active(疯狂买入), happy(虚假的"这次不同"), 
worried(看到崩盘开始), alert(想卖但卖不出), celebrate(不存在—空洞凝视)
```

### C3. ghost_ltcm
```
长期资本管理公司 (LTCM) 幽灵 — 不是个人，是集体实体。
Visual: 一群穿西装的影子人形（诺贝尔奖得主团队），全部震惊表情，数学公式在周围碎裂。
Prop: 裂开的模型/公式写着 "correlation = 1"。
Ghost effect: 数学符号碎裂，方程式故障闪烁。
6 states: idle(影子群体站立), active(疯狂调模型), happy(模型回测完美—虚假安全感), 
worried(相关性突然=1), alert(所有人同时恐慌), celebrate(不存在—集体崩溃)
```

### C4. ghost_lehman
```
雷曼兄弟 (Lehman Brothers) 幽灵 — 机构崩溃化身。
Visual: 华尔街大楼外墙碎裂，或一个穿西装的银行家抱着纸箱（经典被裁画面），呆滞表情。
Prop: 装着个人物品的纸箱（标志性裁员画面）。
Ghost effect: 建筑崩塌，2008 新闻滚动条。
6 states: idle(抱纸箱呆站), active(最后疯狂交易), happy(最后的奖金—空洞), 
worried(电话响不停), alert(CEO说"我们没事"但在颤抖), celebrate(不存在—抱箱离场)
```

### C5. ghost_enron
```
安然 (Enron) 幽灵 — 公司欺诈化身。
Visual: 穿西装的高管旁边有碎纸机，歪斜的 "E" logo，紧张冒汗。
Prop: 到处飞的碎纸片。
Ghost effect: 火焰和烟雾，文件碎纸纷飞。
6 states: idle(紧张站在碎纸机旁), active(疯狂碎纸), happy(假账做好了—紧张的笑), 
worried(FBI 敲门), alert(抱文件逃跑), celebrate(不存在—手铐)
```

### C6. ghost_svb
```
硅谷银行 (SVB) 幽灵 — 期限错配崩溃。
Visual: 硅谷科技银行家混合体，卫衣+西装外套，恐慌表情，手机疯狂震动银行挤兑通知。
Prop: 裂开的沙漏（期限/时间错配隐喻）。
Ghost effect: 数字银行挤兑——钱符号飞走。
6 states: idle(看裂沙漏), active(疯狂安抚客户), happy("利率会转向的"—自我欺骗), 
worried(挤兑开始), alert(关闭取款通道), celebrate(不存在—沙漏碎裂)
```

---

## 总量统计

| 任务 | 角色数 | 每角色图数 | 小计 |
|------|--------|-----------|------|
| A: 补全 5 状态 | 17 | 5 | 85 |
| B: 新 Master 全 6 状态 | 9 | 6 | 54 |
| C: 新 Ghost 全 6 状态 | 6 | 6 | 36 |
| **合计** | **32** | — | **175 张** |

加上已完成的 223 张 = 总计 **398 张**（64 角色 × 约 6 张 + 修复重做的）。

## 建议生成顺序

1. **任务 A** 先做（17 × 5 = 85 张）— idle 锚点已有，一致性有保障
2. **任务 B** 其次（9 × 6 = 54 张）— 新角色，科学家系列
3. **任务 C** 最后（6 × 6 = 36 张）— Ghost 风格特殊，单独批次
