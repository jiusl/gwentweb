// 跨平台端口清理（Windows/Linux/macOS）
const { execSync } = require('child_process');
const os = require('os');

const ports = [3000, 5000];

for (const port of ports) {
  try {
    if (os.platform() === 'win32') {
      execSync(`netstat -ano | findstr :${port}`, { stdio: 'pipe' });
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const lines = out.trim().split('\n');
      for (const line of lines) {
        const pid = line.trim().split(/\s+/).pop();
        if (pid && /^\d+$/.test(pid)) {
          try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' }); } catch {}
        }
      }
    } else {
      try { execSync(`fuser -k ${port}/tcp 2>/dev/null || true`, { stdio: 'pipe' }); } catch {}
    }
  } catch {}
}
