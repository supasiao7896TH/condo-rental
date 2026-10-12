import { describe, it, expect } from 'vitest';
import { CloudSyncManager } from '../src/modules/cloud-sync-manager.js';

describe('CloudSyncManager', () => {
  it('มีสถานะเริ่มต้นเป็น idle', () => {
    expect(CloudSyncManager.getStatus()).toBe('idle');
  });

  it('ส่งการแจ้งเตือนสถานะเมื่อมี listener ลงทะเบียน', () => {
    let captured = null;
    const unsub = CloudSyncManager.onStatusChange((status) => {
      captured = status;
    });
    expect(captured).toBe('idle');
    unsub();
  });
});
