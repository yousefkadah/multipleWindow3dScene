# Multiple Window 3D Scene

This project creates an interactive 3D scene that spans across multiple browser windows, utilizing Three.js for rendering and a custom WindowManager script to synchronize the views and elements across windows.

## Features

*   **Multi-Window Synchronization:** Seamlessly extends the 3D scene across connected browser windows.
*   **Interactive 3D Elements:** Displays interactive 3D spheres representing each connected window.
*   **Dynamic Connections:** Visualizes connections between windows with animated lines.
*   **Ambient Background:** Features a dynamic starfield and ambient particles.

## Technologies Used

*   [Three.js](https://threejs.org/) - A JavaScript 3D library.
*   Custom WindowManager script for handling multi-window communication and layout.

## Setup and Running

1.  Clone or download the project files.
2.  Open the `index.html` file in a web browser.
3.  To experience the multi-window effect, open the same `index.html` file in additional browser windows or tabs. The WindowManager script will automatically detect and connect them.

## Project Structure

*   `index.html`: The main HTML file that sets up the scene and includes the necessary scripts.
*   `main.js`: Contains the core Three.js scene setup, rendering logic, and interaction handling.
*   `WindowManager.js`: Handles the communication and synchronization between multiple browser windows.
*   `three.r124.min.js`: The minified Three.js library.
*   `three-LICENSE`: The license information for Three.js.

## License

[Include license information if applicable, e.g., MIT, Apache 2.0, etc. - You may need to add this based on your project's license.]
