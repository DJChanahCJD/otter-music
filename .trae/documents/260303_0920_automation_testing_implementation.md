# 实施计划：引入 Vitest 自动化测试

## 目标
为 OtterMusic 项目引入轻量级、高效的自动化测试框架 Vitest，覆盖核心业务逻辑和基础组件。

## 步骤

### 1. 环境配置 (Setup Environment)
- [x] 安装依赖：`npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event`
- [x] 创建配置文件 `vitest.config.ts`：配置测试环境为 `jsdom`，启用全局变量。
- [x] 创建测试启动文件 `src/test/setup.ts`：引入 `jest-dom` 扩展匹配器。
- [x] 更新 `tsconfig.json`：添加 `vitest/globals` 类型定义。
- [x] 更新 `package.json`：添加 `"test": "vitest"` 脚本。

### 2. 编写核心逻辑测试 (Core Logic Tests)
- [x] 分析 `src/lib/utils/music.ts` 中的核心函数（如时间格式化、歌词解析等）。
- [x] 创建 `src/lib/utils/music.test.ts` 并编写单元测试用例。
- [x] 运行测试验证配置是否正确。

### 3. 编写组件测试 (Component Tests)
- [ ] 选择基础组件 `src/components/ui/button.tsx` 作为示例。
- [ ] 创建 `src/components/ui/button.test.tsx` 编写渲染测试。
- [ ] 验证组件交互（点击事件）是否正常。

### 4. 验证与文档 (Verification & Documentation)
- [ ] 运行全量测试 `npm run test` 确保所有测试通过。
- [ ] 更新 `README.md` 中的 `自动化测试` 待办项状态。
- [ ] 简单记录如何运行测试。

## 验收标准
1.  能够通过 `npm run test` 运行所有测试。
2.  `src/lib/utils/music.ts` 中的主要工具函数有测试覆盖。
3.  至少有一个 UI 组件的渲染测试通过。
4.  不破坏现有的构建流程。
