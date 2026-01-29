import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';

/**
 * 账号实体接口
 */
export interface Account {
  id: string;                    // UUID 格式的唯一标识
  cookie: string;                // Suno 账号的完整 Cookie 字符串
  status: 'active' | 'disabled'; // 账号状态
  supportedModels: string[];     // 支持的模型列表,空数组表示支持所有模型
  note: string;                  // 备注信息
  lastUpdated: number;           // 最后更新时间戳(毫秒)
}

/**
 * 系统配置接口
 */
export interface SystemConfig {
  key: string;                   // 配置键名
  value: string;                 // 配置值
  updatedAt: number;             // 更新时间戳
}

/**
 * 维护日志接口
 */
export interface MaintenanceLog {
  id: number;                    // 自增 ID
  accountId: string;             // 关联的账号 ID
  operation: string;             // 操作类型: init/maintenance/circuit_break/manual_recover
  status: 'success' | 'failed';  // 操作结果
  message: string;               // 详细信息或错误消息
  timestamp: number;             // 操作时间戳
}

/**
 * 数据库管理器类
 * 封装所有数据库操作,提供类型安全的 CRUD 接口
 */
export class DBManager {
  private db: Database.Database;
  private static instance: DBManager | null = null;

  /**
   * 构造函数 - 私有化以实现单例模式
   * @param dbPath 数据库文件路径
   */
  private constructor(dbPath: string) {
    try {
      // 确保数据目录存在
      const dataDir = path.dirname(dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // 初始化数据库连接
      this.db = new Database(dbPath);
      
      // 启用 WAL 模式提高并发性能
      this.db.pragma('journal_mode = WAL');
      
      // 初始化表结构
      this.initializeTables();
    } catch (error) {
      console.error('数据库初始化失败:', error);
      throw new Error(`DB_INIT_FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取 DBManager 单例实例
   * @param dbPath 数据库文件路径,默认为 ./data/account-pool.db
   * @returns DBManager 实例
   */
  public static getInstance(dbPath: string = './data/account-pool.db'): DBManager {
    // 在 Next.js 环境中使用 globalThis 避免热重载导致的连接泄漏
    const globalForDb = globalThis as typeof globalThis & {
      dbManager?: DBManager;
    };

    if (!globalForDb.dbManager) {
      globalForDb.dbManager = new DBManager(dbPath);
    }

    return globalForDb.dbManager;
  }

  /**
   * 初始化数据库表结构
   */
  private initializeTables(): void {
    try {
      // 创建账号表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY,
          cookie TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('active', 'disabled')),
          supported_models TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          last_updated INTEGER NOT NULL
        );
      `);

      // 创建系统配置表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS system_config (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      // 创建维护日志表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS maintenance_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id TEXT NOT NULL,
          operation TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('success', 'failed')),
          message TEXT NOT NULL,
          timestamp INTEGER NOT NULL
        );
      `);

      // 创建索引
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
        CREATE INDEX IF NOT EXISTS idx_logs_account_id ON maintenance_logs(account_id);
        CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON maintenance_logs(timestamp DESC);
      `);
    } catch (error) {
      console.error('表结构初始化失败:', error);
      throw new Error(`DB_INIT_FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 添加账号
   * @param account 账号信息(不包含 id 和 lastUpdated)
   * @returns 完整的账号对象
   */
  public addAccount(account: Omit<Account, 'id' | 'lastUpdated'>): Account {
    try {
      const id = randomUUID();
      const lastUpdated = Date.now();
      const supportedModelsJson = JSON.stringify(account.supportedModels);

      const stmt = this.db.prepare(`
        INSERT INTO accounts (id, cookie, status, supported_models, note, last_updated)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(id, account.cookie, account.status, supportedModelsJson, account.note, lastUpdated);

      return {
        id,
        cookie: account.cookie,
        status: account.status,
        supportedModels: account.supportedModels,
        note: account.note,
        lastUpdated,
      };
    } catch (error) {
      console.error('添加账号失败:', error);
      throw new Error(`DB_WRITE_FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取单个账号
   * @param id 账号 ID
   * @returns 账号对象或 null
   */
  public getAccount(id: string): Account | null {
    try {
      const stmt = this.db.prepare(`
        SELECT id, cookie, status, supported_models, note, last_updated
        FROM accounts
        WHERE id = ?
      `);

      const row = stmt.get(id) as any;
      if (!row) return null;

      return {
        id: row.id,
        cookie: row.cookie,
        status: row.status,
        supportedModels: JSON.parse(row.supported_models),
        note: row.note,
        lastUpdated: row.last_updated,
      };
    } catch (error) {
      console.error('查询账号失败:', error);
      throw new Error(`DB_READ_FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取所有账号
   * @returns 账号列表
   */
  public getAllAccounts(): Account[] {
    try {
      const stmt = this.db.prepare(`
        SELECT id, cookie, status, supported_models, note, last_updated
        FROM accounts
      `);

      const rows = stmt.all() as any[];

      return rows.map(row => ({
        id: row.id,
        cookie: row.cookie,
        status: row.status,
        supportedModels: JSON.parse(row.supported_models),
        note: row.note,
        lastUpdated: row.last_updated,
      }));
    } catch (error) {
      console.error('查询所有账号失败:', error);
      throw new Error(`DB_READ_FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 更新账号
   * @param id 账号 ID
   * @param updates 要更新的字段
   * @returns 是否更新成功
   */
  public updateAccount(id: string, updates: Partial<Account>): boolean {
    try {
      const fields: string[] = [];
      const values: any[] = [];

      if (updates.cookie !== undefined) {
        fields.push('cookie = ?');
        values.push(updates.cookie);
      }
      if (updates.status !== undefined) {
        fields.push('status = ?');
        values.push(updates.status);
      }
      if (updates.supportedModels !== undefined) {
        fields.push('supported_models = ?');
        values.push(JSON.stringify(updates.supportedModels));
      }
      if (updates.note !== undefined) {
        fields.push('note = ?');
        values.push(updates.note);
      }

      // 总是更新 lastUpdated
      fields.push('last_updated = ?');
      values.push(Date.now());

      if (fields.length === 1) {
        // 只有 lastUpdated,没有实际更新
        return false;
      }

      values.push(id);

      const stmt = this.db.prepare(`
        UPDATE accounts
        SET ${fields.join(', ')}
        WHERE id = ?
      `);

      const result = stmt.run(...values);
      return result.changes > 0;
    } catch (error) {
      console.error('更新账号失败:', error);
      throw new Error(`DB_WRITE_FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 删除账号
   * @param id 账号 ID
   * @returns 是否删除成功
   */
  public deleteAccount(id: string): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM accounts WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('删除账号失败:', error);
      throw new Error(`DB_WRITE_FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取系统配置
   * @param key 配置键名
   * @returns 配置值或 null
   */
  public getConfig(key: string): string | null {
    try {
      const stmt = this.db.prepare('SELECT value FROM system_config WHERE key = ?');
      const row = stmt.get(key) as any;
      return row ? row.value : null;
    } catch (error) {
      console.error('查询配置失败:', error);
      throw new Error(`DB_READ_FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 设置系统配置
   * @param key 配置键名
   * @param value 配置值
   */
  public setConfig(key: string, value: string): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO system_config (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `);

      stmt.run(key, value, Date.now());
    } catch (error) {
      console.error('设置配置失败:', error);
      throw new Error(`DB_WRITE_FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 添加日志
   * @param log 日志信息(不包含 id 和 timestamp)
   */
  public addLog(log: Omit<MaintenanceLog, 'id' | 'timestamp'>): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO maintenance_logs (account_id, operation, status, message, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `);

      stmt.run(log.accountId, log.operation, log.status, log.message, Date.now());
    } catch (error) {
      console.error('添加日志失败:', error);
      throw new Error(`DB_WRITE_FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取日志
   * @param filters 筛选条件
   * @returns 日志列表
   */
  public getLogs(filters?: { accountId?: string; limit?: number; offset?: number }): MaintenanceLog[] {
    try {
      let query = 'SELECT id, account_id, operation, status, message, timestamp FROM maintenance_logs';
      const params: any[] = [];

      if (filters?.accountId) {
        query += ' WHERE account_id = ?';
        params.push(filters.accountId);
      }

      query += ' ORDER BY timestamp DESC';

      if (filters?.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);
      }

      if (filters?.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params) as any[];

      return rows.map(row => ({
        id: row.id,
        accountId: row.account_id,
        operation: row.operation,
        status: row.status,
        message: row.message,
        timestamp: row.timestamp,
      }));
    } catch (error) {
      console.error('查询日志失败:', error);
      throw new Error(`DB_READ_FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 执行事务
   * @param fn 事务函数
   * @returns 事务函数的返回值
   */
  public transaction<T>(fn: () => T): T {
    try {
      return this.db.transaction(fn)();
    } catch (error) {
      console.error('事务执行失败:', error);
      throw new Error(`DB_WRITE_FAILED: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 关闭数据库连接
   */
  public close(): void {
    this.db.close();
  }

  /**
   * 重置单例实例（仅用于测试）
   * @internal
   */
  public static resetInstance(): void {
    const globalForDb = globalThis as typeof globalThis & {
      dbManager?: DBManager;
    };
    
    if (globalForDb.dbManager) {
      try {
        globalForDb.dbManager.close();
      } catch (e) {
        // 忽略关闭错误
      }
      globalForDb.dbManager = undefined;
    }
  }
}
