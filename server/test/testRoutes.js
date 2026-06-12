/**
 * API 路由 —— 单元测试
 * 覆盖 GET /api/health, /api/matches/:userId, /api/stats/:userId
 */

const request = require('supertest');
const express = require('express');

// Mock dbUtils 避免真实数据库调用
jest.mock('../db/dbUtils', () => ({
  getMatchHistory: jest.fn(),
  getUserStats: jest.fn(),
}));

const router = require('../routes/index');
const dbUtils = require('../db/dbUtils');

// 构建最小 Express 应用加载路由
const app = express();
app.use(express.json());
app.use('/api', router);

describe('API 路由', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== 健康检查 ====================

  describe('GET /api/health', () => {
    test('应返回 200 和 ok 状态', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  // ==================== 对局历史 ====================

  describe('GET /api/matches/:userId', () => {
    const sampleMatches = [
      {
        id: 1,
        match_uuid: '12345-abc',
        player1_id: 1,
        player2_id: 2,
        winner_id: 1,
        player1_score: 2,
        player2_score: 1,
        rounds_played: 3,
        match_type: 'casual',
        player1_name: 'alice',
        player2_name: 'bob',
        winner_name: 'alice',
      },
      {
        id: 2,
        match_uuid: '12346-def',
        player1_id: 1,
        player2_id: null,
        winner_id: 1,
        player1_score: 2,
        player2_score: 0,
        rounds_played: 2,
        match_type: 'vs_ai',
        player1_name: 'alice',
        player2_name: null,
        winner_name: 'alice',
      },
    ];

    test('应返回用户的对局历史', async () => {
      dbUtils.getMatchHistory.mockResolvedValue(sampleMatches);

      const res = await request(app).get('/api/matches/1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.count).toBe(2);
      expect(res.body.data[0].match_type).toBe('casual');
    });

    test('应支持 limit 查询参数', async () => {
      dbUtils.getMatchHistory.mockResolvedValue([sampleMatches[0]]);

      const res = await request(app).get('/api/matches/1?limit=1');
      expect(res.status).toBe(200);
      expect(dbUtils.getMatchHistory).toHaveBeenCalledWith(1, 1);
      expect(res.body.data).toHaveLength(1);
    });

    test('limit 超过 50 时应截断为 50', async () => {
      dbUtils.getMatchHistory.mockResolvedValue([]);

      await request(app).get('/api/matches/1?limit=999');
      expect(dbUtils.getMatchHistory).toHaveBeenCalledWith(1, 50);
    });

    test('limit 为负数时应使用默认值 10', async () => {
      dbUtils.getMatchHistory.mockResolvedValue([]);

      await request(app).get('/api/matches/1?limit=-5');
      expect(dbUtils.getMatchHistory).toHaveBeenCalledWith(1, 10);
    });

    test('无效 userId 应返回 400', async () => {
      const res = await request(app).get('/api/matches/abc');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('无效的用户 ID');
    });

    test('userId 为 0 应返回 400', async () => {
      const res = await request(app).get('/api/matches/0');
      expect(res.status).toBe(400);
    });

    test('userId 为负数应返回 400', async () => {
      const res = await request(app).get('/api/matches/-1');
      expect(res.status).toBe(400);
    });

    test('数据库错误时应返回 500', async () => {
      dbUtils.getMatchHistory.mockRejectedValue(new Error('DB connection lost'));

      const res = await request(app).get('/api/matches/1');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('服务器内部错误');
    });

    test('没有对局记录时应返回空数组', async () => {
      dbUtils.getMatchHistory.mockResolvedValue([]);

      const res = await request(app).get('/api/matches/1');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.count).toBe(0);
    });
  });

  // ==================== 用户统计 ====================

  describe('GET /api/stats/:userId', () => {
    const sampleStats = {
      user_id: 1,
      total_matches: 42,
      wins: 25,
      losses: 15,
      draws: 2,
      total_points: 3840,
      favorite_faction: 'northern',
    };

    test('应返回用户统计数据（含胜率）', async () => {
      dbUtils.getUserStats.mockResolvedValue(sampleStats);

      const res = await request(app).get('/api/stats/1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total_matches).toBe(42);
      expect(res.body.data.wins).toBe(25);
      expect(res.body.data.winRate).toBe('59.5%');
    });

    test('无对局记录时胜率应为 0.0%', async () => {
      dbUtils.getUserStats.mockResolvedValue({
        total_matches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
      });

      const res = await request(app).get('/api/stats/1');
      expect(res.status).toBe(200);
      expect(res.body.data.winRate).toBe('0.0%');
    });

    test('胜率 100% 时计算正确', async () => {
      dbUtils.getUserStats.mockResolvedValue({
        total_matches: 10,
        wins: 10,
        losses: 0,
        draws: 0,
      });

      const res = await request(app).get('/api/stats/1');
      expect(res.body.data.winRate).toBe('100.0%');
    });

    test('无效 userId 应返回 400', async () => {
      const res = await request(app).get('/api/stats/invalid');
      expect(res.status).toBe(400);
    });

    test('数据库错误时应返回 500', async () => {
      dbUtils.getUserStats.mockRejectedValue(new Error('DB connection lost'));

      const res = await request(app).get('/api/stats/1');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('服务器内部错误');
    });

    test('dbUtils 返回 null 时应有默认值', async () => {
      dbUtils.getUserStats.mockResolvedValue(null);

      const res = await request(app).get('/api/stats/1');
      expect(res.status).toBe(200);
      expect(res.body.data.total_matches).toBe(0);
      expect(res.body.data.winRate).toBe('0.0%');
    });
  });
});
