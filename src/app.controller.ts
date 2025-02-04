import { Controller, Get, Header } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/')
  @Header('Content-Type', 'text/html')
  getHello(): string {
    const version = process.env.npm_package_version || '1.0.0';
    const uptime = this.formatUptime(process.uptime());
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Chaos Chess API</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              line-height: 1.5;
              margin: 0;
              padding: 2rem;
              background: linear-gradient(to bottom, #1a1a1a, #2d2d2d);
              color: #ffffff;
              min-height: 100vh;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
            }
            h1 {
              font-size: 2.5rem;
              margin-bottom: 1rem;
              background: linear-gradient(45deg, #ff4d4d, #ff9900);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            .status-card {
              background: rgba(255, 255, 255, 0.1);
              border-radius: 12px;
              padding: 1.5rem;
              margin: 1rem 0;
              backdrop-filter: blur(10px);
              border: 1px solid rgba(255, 255, 255, 0.1);
            }
            .status-item {
              display: flex;
              justify-content: space-between;
              padding: 0.5rem 0;
              border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            }
            .status-item:last-child {
              border-bottom: none;
            }
            .badge {
              background: #22c55e;
              color: white;
              padding: 0.25rem 0.75rem;
              border-radius: 9999px;
              font-size: 0.875rem;
            }
            .description {
              color: #a3a3a3;
              margin: 1rem 0 2rem 0;
            }
            .endpoints {
              list-style: none;
              padding: 0;
            }
            .endpoint {
              background: rgba(0, 0, 0, 0.2);
              padding: 1rem;
              border-radius: 8px;
              margin-bottom: 0.5rem;
              font-family: monospace;
            }
            .method {
              color: #22c55e;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🎮 Chaos Chess API</h1>
            <p class="description">
              Welcome to the Chaos Chess API - Where chess meets chaos in the most exciting way!
            </p>
            
            <div class="status-card">
              <div class="status-item">
                <span>Status</span>
                <span class="badge">Operational</span>
              </div>
              <div class="status-item">
                <span>Version</span>
                <span>${version}</span>
              </div>
              <div class="status-item">
                <span>Uptime</span>
                <span>${uptime}</span>
              </div>
              <div class="status-item">
                <span>Environment</span>
                <span>${process.env.NODE_ENV || 'development'}</span>
              </div>
            </div>

            <h2>Available Endpoints</h2>
            <ul class="endpoints">
              <li class="endpoint">
                <span class="method">GET</span> /health - Health check endpoint
              </li>
              <li class="endpoint">
                <span class="method">WS</span> /lobby - WebSocket connection for game lobby
              </li>
              <li class="endpoint">
                <span class="method">WS</span> /game - WebSocket connection for active games
              </li>
            </ul>
          </div>
        </body>
      </html>
    `;
  }

  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }

  private formatUptime(uptime: number): string {
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    return parts.join(' ');
  }
}
