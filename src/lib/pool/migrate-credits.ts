/**
 * 数据库迁移脚本：添加积分信息字段
 * 为现有的 accounts 表添加积分相关字段
 */

import { DBManager } from './db-manager';

/**
 * 执行迁移
 */
export function migrateCreditsFields() {
  const dbManager = DBManager.getInstance();
  const db = (dbManager as any).db;

  try {
    console.log('开始迁移：添加积分信息字段...');

    // 检查字段是否已存在
    const tableInfo = db.pragma('table_info(accounts)');
    const existingColumns = tableInfo.map((col: any) => col.name);

    const fieldsToAdd = [
      { name: 'credits_left', type: 'INTEGER' },
      { name: 'monthly_limit', type: 'INTEGER' },
      { name: 'monthly_usage', type: 'INTEGER' },
      { name: 'credits_updated_at', type: 'INTEGER' },
    ];

    let addedCount = 0;

    for (const field of fieldsToAdd) {
      if (!existingColumns.includes(field.name)) {
        console.log(`添加字段: ${field.name}`);
        db.exec(`ALTER TABLE accounts ADD COLUMN ${field.name} ${field.type}`);
        addedCount++;
      } else {
        console.log(`字段已存在: ${field.name}`);
      }
    }

    if (addedCount > 0) {
      console.log(`✓ 迁移完成，添加了 ${addedCount} 个字段`);
    } else {
      console.log('✓ 所有字段已存在，无需迁移');
    }

    return true;
  } catch (error) {
    console.error('迁移失败:', error);
    return false;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  migrateCreditsFields();
  process.exit(0);
}
