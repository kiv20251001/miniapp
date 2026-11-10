# 领域口径

业务不变量以 `.cursor/skills/myhome-backend-contracts/` 为准：

- 能力、页面与组件领域：[capability-map.md](../../.cursor/skills/myhome-backend-contracts/capability-map.md)
- 页面交互：[product-map.md](../../.cursor/skills/myhome-backend-contracts/product-map.md)
- 账号与家庭：[account-model.md](../../.cursor/skills/myhome-backend-contracts/account-model.md)
- 数据与接口：[data-and-api.md](../../.cursor/skills/myhome-backend-contracts/data-and-api.md)
- 规则与事务：[backend-contracts.md](../../.cursor/skills/myhome-backend-contracts/backend-contracts.md)
- 计费模型：[billing-model-v2.md](../../.cursor/skills/myhome-backend-contracts/billing-model-v2.md)
- 已知缺口：[gaps-and-backlog.md](../../.cursor/skills/myhome-backend-contracts/gaps-and-backlog.md)

这里只放给人读的摘要，避免两处长期打架。

摘要：

- 当前 H5 是家长端：今日、日历、统计、本周账单默认看全家；课程页和记一笔目前按会话选中的孩子过滤（计划对齐，见缺口文档）。
- 至少一名孩子。
- 课程可多孩子共享；删一个孩子时不得删掉共享课，只解绑。
- 排课例外跟课程走；时间冲突按孩子隔离。
- 独享课、该孩子账单与目标随孩子删除。
- 费用四层：实际支出看 Payment 支付日净额；待支付、待结算、预计分开。家长课次行只展示已支付 / 未支付。
- 一期已用账号+密码登录；家庭是租户，接口见 data-and-api。
