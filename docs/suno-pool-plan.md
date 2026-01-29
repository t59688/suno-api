# Suno 号池方案（含按模型筛选）

## 变更说明：每个 CK 支持多选模型

在原有号池方案基础上，增加「每个 cookie 支持多选模型」与「生成时按用户传入模型从号池筛选 CK」。

---

## 1. SQLite 表结构（更新）

**suno_accounts** 增加字段：

- `supported_models` (TEXT)：该账号支持的模型列表，存 JSON 数组字符串，如 `["chirp-crow","chirp-v3-5","chirp-v3"]`。  
  - 若为空或 NULL，视为支持全部模型（兼容旧数据）。

**示例**：

| id | cookie | status | supported_models | last_updated | ... |
|----|--------|--------|------------------|--------------|-----|
| 1 | __client=... | active | ["chirp-crow","chirp-v3-5"] | 2025-01-29 | ... |
| 2 | __client=... | active | ["chirp-crow"] | 2025-01-29 | ... |

---

## 2. 号池接口（更新）

**getNextInstance(model?: string): Promise<SunoApi>**

- **无 model**：与现有一致，从当前**所有** active 实例中负载均衡（轮询/随机）返回一个。
- **有 model**：只从「该账号的 `supported_models` 包含该 model」的实例中选一个；若没有支持该 model 的 CK，则 throw 明确错误（如「号池中无支持模型 xxx 的账号」）。

实现要点：

- 内存池结构需能按账号 id 查到「该账号的 supported_models」（可从 DB 加载时一并读入，如 `Map<id, { api, supportedModels: string[] }>`）。
- 筛选逻辑：`supported_models` 为空/未配置时视为支持所有模型（即该账号始终可被选中）。

---

## 3. API 调用处（更新）

凡「用户可传入模型」的接口，在向号池要实例时传入 model，其余不变：

- **generate**：body 中有 `model`，调用 `getSunoPool().getNextInstance(body.model)`。
- **custom_generate**：同上，传 `body.model`。
- **extend_audio**：同上，传 `body.model`。
- **get / getClip / getCredits / generate_lyrics / generate_stems / get_aligned_lyrics / concat / persona / v1/chat/completions**：不传 model（或传 undefined），按原逻辑从全池取实例。

这样「用户传入模型 → 自动从号池里找到支持该模型的 CK」即可实现。

---

## 4. 管理/配置

- 新增/编辑账号时，需支持为 `supported_models` 多选（如 chirp-crow、chirp-v3-5、chirp-v3 等，与 [SunoApi.ts](src/lib/SunoApi.ts) 中 DEFAULT_MODEL 及实际可用模型一致）。
- 可选：提供「支持模型列表」的常量或配置（如 `SUPPORTED_MODELS = ['chirp-crow','chirp-v3-5','chirp-v3']`），便于前端/管理端多选与校验。

---

## 5. 小结

- 每个 CK 在 DB 中增加 `supported_models`（多选，JSON 数组）。
- 生成类接口传入 model 时，`getNextInstance(model)` 只从支持该 model 的 CK 中做负载均衡；未传 model 或不需要模型的接口仍从全池取实例。
- 无支持该 model 的 CK 时，直接报错，便于用户排查或扩容账号。

以上为对原号池方案的补充，其余（负载均衡、自动维护、异常 CK、重启恢复）不变。
