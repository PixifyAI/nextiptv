# Extreme Code IPTV Next.js App

This is a web application built with Next.js, React, TypeScript, and Tailwind CSS. It includes a frontend interface and a backend API proxy for IPTV services.

## Project Structure

```
.
├── app/                      # Main application directory (App Router)
│   ├── api/                  # API routes
│   │   └── iptv-proxy/       # IPTV proxy endpoint
│   │       └── route.ts
│   ├── globals.css           # Global styles
│   ├── layout.tsx            # Root layout component
│   └── page.tsx              # Main page component
├── public/                   # Static assets (if any, currently empty)
├── next.config.mjs           # Next.js configuration
├── package.json              # Project dependencies and scripts
├── postcss.config.mjs        # PostCSS configuration (for Tailwind)
├── tailwind.config.ts        # Tailwind CSS configuration
├── tsconfig.json             # TypeScript configuration
└── README.md                 # This file
```

## Getting Started

### Prerequisites

*   Node.js (Version 20.x or later recommended)
*   npm (usually comes with Node.js) or yarn

### Installation

1.  Clone the repository (if applicable).
2.  Navigate to the project directory:
    ```bash
    cd path/to/ExtremeCodeIPTVnext
    ```
3.  Install the dependencies:
    ```bash
    npm install
    # or
    # yarn install
    ```

### Running the Development Server

To start the development server, run:

```bash
npm run dev
# or
# yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The main page can be edited at `app/page.tsx`. The page auto-updates as you edit the file.

### Building for Production

To build the application for production, run:

```bash
npm run build
# or
# yarn build
```

### Starting the Production Server

To start the production server after building, run:

```bash
npm run start
# or
# yarn start
```

## Key Technologies

*   **Next.js:** React framework for server-side rendering, static site generation, API routes, etc.
*   **React:** JavaScript library for building user interfaces.
*   **TypeScript:** Superset of JavaScript that adds static typing.
*   **Tailwind CSS:** Utility-first CSS framework for rapid UI development.

## API Endpoint

*   `/api/iptv-proxy`: This route likely acts as a proxy for external IPTV services. The implementation details are in `app/api/iptv-proxy/route.ts`.
