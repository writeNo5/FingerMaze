# 🌀 Finger Maze: Abyssal Descent

**A futuristic portal-themed maze exploration game with fog of war mechanics**

![Game Preview](https://img.shields.io/badge/Status-Active-success)
![Tech](https://img.shields.io/badge/Tech-p5.js-pink)
![License](https://img.shields.io/badge/License-MIT-blue)

## 🎮 Game Overview

Navigate a mysterious rolling sphere through procedurally generated cave mazes using trackpad-style controls. Discover hidden portals in the darkness and descend deeper into the abyss with each level.

### ✨ Key Features

- **🌫️ Fog of War**: Only see walls within your sphere's radius
- **🔮 Futuristic Portal Design**: Hexagonal rings, pulsing cores, and cyan glows
- **🎯 Trackpad Controls**: Chrome Remote Desktop-style relative movement
- **🎲 Randomized Levels**: Every descent brings new challenges
- **📱 Mobile & Desktop**: Fully responsive touch and mouse support
- **🎨 Unified Design System**: Cohesive cyan-themed UI across all elements

## 🚀 Quick Start

### Play Online
Simply open `index.html` in your browser - no installation required!

### Local Setup
```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/fingerMaze.git

# Navigate to the project
cd fingerMaze

# Open in browser
# Just double-click index.html or use a local server
```

### Using a Local Server (Recommended)
```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server

# Then visit: http://localhost:8000
```

## 🎯 How to Play

1. **Start**: Click the glowing "START EXPLORATION" button
2. **Move**: Click/touch and drag anywhere on screen to move the sphere
3. **Explore**: Navigate through the fog to find the cyan portal
4. **Descend**: Enter the portal to progress to deeper levels
5. **Restart**: Use the HUD button anytime to start fresh

### Controls
- **Desktop**: Click and drag (trackpad mode)
- **Mobile**: Touch and drag
- **Restart**: Click RESTART button in top-left HUD

## 🛠️ Technology Stack

- **p5.js** - Creative coding framework
- **Vanilla JavaScript** - Core game logic
- **CSS3** - Futuristic UI styling with glassmorphism
- **HTML5 Canvas** - Rendering engine

## 📁 Project Structure

```
fingerMaze/
├── index.html          # Main HTML file
├── sketch.js           # Game logic & rendering
├── style.css           # Unified design system
├── PROJECT_VISION.md   # Design philosophy
└── README.md           # This file
```

## 🎨 Design Philosophy

The game features a cohesive **"Futuristic Portal"** theme:
- **Cyan Color Palette** (#00ffff, rgba(0, 200-255, 255))
- **Hexagonal Geometry** - Portal and sphere share rotating hex rings
- **Pulsing Animations** - Living, breathing UI elements
- **Glassmorphism** - Backdrop blur with gradient overlays
- **Fog of War** - Limited visibility creates tension and discovery

## 🔧 Customization

### Adjust Difficulty
In `sketch.js`, modify these values:
```javascript
let sensitivity = 0.75;        // Control sensitivity
let groundFriction = 0.55;     // Movement resistance
let visibilityRadius = 180;    // Fog of war range
```

### Change Portal Appearance
In `drawGoal()` function:
```javascript
// Modify colors, ring count, or animation speed
stroke(0, 220, 255, 180);     // Portal color
rotate(frameCount * 0.02);     // Rotation speed
```

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests
- Improve documentation

## 📜 License

MIT License - Feel free to use this project for learning or your own games!

## 🙏 Credits

**Development Team**:
- **Julian** (Producer) - Project direction & architecture
- **Minho** (Frontend) - Visual design & implementation
- **Ken** (QA) - Testing & optimization
- **Hana** (Designer) - UI/UX design system

**Technologies**:
- [p5.js](https://p5js.org/) - Creative coding framework
- [Google Fonts - Outfit](https://fonts.google.com/specimen/Outfit)

## 📞 Contact

Have questions or feedback? Open an issue on GitHub!

---

**Made with 💙 by the Finger Maze Team**

*Descend into the abyss... if you dare.* 🌀
