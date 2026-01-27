# SemanticStudio Promotional Collateral

This directory contains assets and scripts for creating promotional content for SemanticStudio.

## Directory Structure

```
promo/
├── README.md              # This file
├── summaries.md           # LinkedIn posts and marketing copy
├── capture-tour.ts        # Playwright automation script
├── screenshots/           # Captured screenshots
└── video/                 # Generated video output
```

## Quick Start

### 1. Install Dependencies

```bash
# If Playwright isn't installed
npm install -D playwright
npx playwright install chromium
```

### 2. Ensure SemanticStudio is Running

```bash
npm run dev
# Verify at http://localhost:3000
```

### 3. Capture Screenshots

```bash
# Run the automated tour capture
npx tsx promo/capture-tour.ts
```

### 4. Create Video from Screenshots

```bash
# Using ffmpeg (2 seconds per frame)
ffmpeg -framerate 0.5 -pattern_type glob -i 'promo/screenshots/tour-*.png' \
  -c:v libx264 -r 30 -pix_fmt yuv420p \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" \
  promo/video/semanticstudio-tour.mp4
```

#### Video Options

**Slower pace (3 seconds per frame):**
```bash
ffmpeg -framerate 0.33 -pattern_type glob -i 'promo/screenshots/tour-*.png' \
  -c:v libx264 -r 30 -pix_fmt yuv420p \
  promo/video/semanticstudio-tour-slow.mp4
```

**With fade transitions:**
```bash
ffmpeg -framerate 0.5 -pattern_type glob -i 'promo/screenshots/tour-*.png' \
  -vf "zoompan=z='if(lte(zoom,1.0),1.05,max(1.001,zoom-0.0015))':d=60:s=1920x1080,fade=t=in:st=0:d=0.5,fade=t=out:st=1.5:d=0.5" \
  -c:v libx264 -pix_fmt yuv420p \
  promo/video/semanticstudio-tour-fade.mp4
```

**GIF for social (lower quality, smaller file):**
```bash
ffmpeg -framerate 0.5 -pattern_type glob -i 'promo/screenshots/tour-*.png' \
  -vf "scale=960:540,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
  promo/video/semanticstudio-tour.gif
```

## Manual Screenshot Capture Guide

If automated capture doesn't work, here's the manual tour flow:

### Act 1: Chat Experience
1. `http://localhost:3000` - Welcome screen
2. Click mode dropdown - Show Quick/Think/Deep/Research modes
3. Type query in chat box
4. Click trace toggle button - Show Agent Trace panel
5. Toggle web search switch
6. Click attachment button - Show file upload options

### Act 2: Admin Configuration  
7. `/admin` - Dashboard with stats
8. `/admin/agents` - Domain agents grid (28 agents)
9. Filter by category (Customer, Finance, etc.)
10. Click Edit on an agent - Show configuration dialog
11. `/admin/models` - LLM model configuration
12. `/admin/modes` - Mode pipeline configuration

### Act 3: Data & Intelligence
13. `/admin/graph` - 3D knowledge graph
14. Click on a node - Show details panel
15. `/admin/etl` - ETL job management
16. `/admin/data` - Data sources

### Act 4: Session Management
17. Back to chat - Show session pane with history
18. `/settings` - Global settings

## Screenshot Tips for LinkedIn

- **Aspect Ratio:** 1920x1080 (16:9) works best for video
- **Dark Mode:** The app uses dark theme which looks professional
- **Highlight Features:** 
  - 28 agents visible in grid
  - Mode dropdown showing all 4 options
  - 3D graph with nodes/edges
  - Trace panel showing agent events

## Best Hero Images

1. **Chat interface** - Shows modes, input, clean UI
2. **Agents grid** - Visual proof of 28 agents
3. **Knowledge graph** - Eye-catching 3D visualization
4. **Mode config** - Pipeline flow diagram

## LinkedIn Content

See `summaries.md` for:
- 4 ready-to-post LinkedIn articles
- One-line taglines
- Key stats
- Recommended hashtags
