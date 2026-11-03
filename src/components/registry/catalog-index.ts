/** The 131 EasyUI components (easyui.site), generated from their public index. */
export interface CatalogEntry {
  id: string
  name: string
  description: string
  category: "Motion" | "Interface"
}

const MOTION = /particle|meteor|star|warp|glitch|orbit|morph|blob|liquid|gooey|spark|shader|dot-field|glyph|scramble|eye|party|burst|smoke|ripple|neon|rainbow|speed|depth|density/

const RAW: Omit<CatalogEntry, "category">[] = [
 {
  "id": "activity-feed",
  "name": "Activity Feed",
  "description": "A developer telemetry and audit log stream featuring category filtering, live real-time event simulation with Framer Motion slide insertions, and expandable JSON payloads."
 },
 {
  "id": "activity-heatmap",
  "name": "Activity Heatmap",
  "description": "A GitHub-style contribution calendar and weekday-by-hour activity grid with automatic column fitting, quarterly color levels, hover tooltips, and keyboard navigation."
 },
 {
  "id": "advanced-data-table",
  "name": "Advanced Data Table",
  "description": "A powerful, accessible data table component with multi-column sorting, faceted filters, global search, row selection, bulk actions, expandable sub-rows, and pagination."
 },
 {
  "id": "ai-agent-activity",
  "name": "AI Agent Activity",
  "description": "A timeline component for tracking AI agent reasoning, tool calls, API queries, database fetches, and execution states with inspectable parameters and results."
 },
 {
  "id": "ai-response",
  "name": "AI Response",
  "description": "A production-ready, accessible AI response component supporting streaming markdown, syntax-styled code blocks, citations, feedback actions, and tool execution status."
 },
 {
  "id": "airport-matrix-clock",
  "name": "Airport Matrix Clock",
  "description": "A live world clock that renders local times and city names as crisp dot-matrix characters with restrained, character-level rolling transitions."
 },
 {
  "id": "alert",
  "name": "Alert",
  "description": "An alert component that collapses smoothly in height and opacity on dismissal, with tone-aware icons, action slot, and accessibility roles."
 },
 {
  "id": "animated-file-upload",
  "name": "Animated File Upload",
  "description": "A minimal, physical drag-and-drop file uploader with smooth drop reaction, independent file upload tracking, progressive state morphing, and accessible retry flows."
 },
 {
  "id": "animated-number",
  "name": "Animated Number Morph",
  "description": "An Apple-grade smooth rolling digit counter that independently morphs individual numerical columns with physics-based springs, locale commas, currencies, and compact notation."
 },
 {
  "id": "animated-tabs",
  "name": "Animated Tabs",
  "description": "A tabbed switcher with physical pill indicator sliding smoothly between active items with content cross-fades."
 },
 {
  "id": "avatar-stack",
  "name": "Avatar Stack",
  "description": "An interactive, stacked facepile of overlapping avatars that smoothly elevates and scales the hovered avatar to the front with spring physics, revealing the full image and name tooltip."
 },
 {
  "id": "badge",
  "name": "Badge",
  "description": "An animated status badge where numbers and strings roll on value change, with live status pulse dot, removable chip actions, and rich tone variants."
 },
 {
  "id": "bar-chart",
  "name": "Bar Chart",
  "description": "A hand-written, dependency-free SVG bar chart with grouped and stacked layouts, morphing bar transitions, interactive legend toggles, and accessible hover and keyboard tooltips."
 },
 {
  "id": "batch-gesture-tray",
  "name": "Batch Gesture Tray",
  "description": "A touch-ready contextual tray that slides into view upon item selection, presenting bulk actions and real-time count telemetry."
 },
 {
  "id": "book-call-button",
  "name": "Book Call Button",
  "description": "A premium \"Book a call\" pill with a green expanding capsule. At rest, a 36% accent capsule holds a dotted arrow + label; on hover, the capsule fills the pill, the label slides out, and a phone icon with ringing lines fades in centered."
 },
 {
  "id": "branching-submenu",
  "name": "Branching Submenu",
  "description": "A spatial submenu that connects parent options to child actions with staged branch motion."
 },
 {
  "id": "breadcrumb",
  "name": "Breadcrumb",
  "description": "A navigation trail with a gliding hover pill, smooth expansion for collapsed trails with automatic focus transfer, and light/dark theme adaptation."
 },
 {
  "id": "button",
  "name": "Button",
  "description": "A versatile, production-ready button system with 8 visual variants, 4 sizes, loading spinner states, icon slots, and spring tap feedback."
 },
 {
  "id": "calendar",
  "name": "Calendar",
  "description": "A dependency-free calendar with a selected-day pill that glides from date to date, range support with a live hover preview band, and months that slide in the direction you navigate."
 },
 {
  "id": "car-smoke-page-transition",
  "name": "Car Smoke Page Transition",
  "description": "A cinematic page transition where a speeding car crosses the screen, leaving a smoke trail before transitioning to the next page."
 },
 {
  "id": "chat",
  "name": "Chat",
  "description": "A production-grade conversational chat component with thread history sidebar, rich message rendering, status indicators, file attachments, and auto-expanding composer."
 },
 {
  "id": "circular-orbit",
  "name": "Circular Orbit",
  "description": "A circular gallery of image tiles orbiting around a centered title. All motion runs on a single MotionValue driven by useAnimationFrame, so no React renders per frame."
 },
 {
  "id": "code-snippet-deck",
  "name": "Code Snippet Deck",
  "description": "An interactive multi-runtime developer code snippet deck with runtime switching (cURL, TypeScript, Python, Go, Rust), live dynamic parameter customizations, and line highlighting."
 },
 {
  "id": "combobox",
  "name": "Combobox",
  "description": "A searchable select where one highlight glides between options as you move (keyboard or mouse), the match underlines as you type, and the check pops in on selection."
 },
 {
  "id": "command-menu",
  "name": "Command Menu",
  "description": "A global keyboard-first command palette with fuzzy filtering, category badges, and keyboard arrow controls."
 },
 {
  "id": "cursor-follower",
  "name": "Cursor Follower",
  "description": "A smooth spring-based cursor follower with customizable physics, velocity scaling, and custom child icons or badges."
 },
 {
  "id": "date-picker",
  "name": "Date Picker",
  "description": "A date picker (and date range picker) whose popover pops from the trigger edge with a spring, flips above when there is no room below, lands the selection pill, then closes and hands focus back to the trigger."
 },
 {
  "id": "density-lens",
  "name": "Density Lens",
  "description": "An interactive floating lens that tracks pointer movement to reveal high-density data, magnified details, or alternative views."
 },
 {
  "id": "dependency-trace",
  "name": "Dependency Trace",
  "description": "An interactive SVG node graph that maps and dynamically traces relationship connections with directional bezier curves."
 },
 {
  "id": "depth-corridor",
  "name": "Depth Corridor",
  "description": "A 3D spatial layer stack with receding perspective depth, progressive focal blurs, and pointer parallax motion."
 },
 {
  "id": "directional-tooltip",
  "name": "DirectionalTooltip",
  "description": "A tooltip that appears from the direction it originates — it starts a small distance outside the trigger in its preferred direction and springs inward, so it feels like it materializes from the trigger."
 },
 {
  "id": "donut-chart",
  "name": "Donut Chart",
  "description": "A hand-written SVG donut and half-ring gauge with animated arcs, a live center readout, hover highlighting, and a legend that filters slices without collapsing the ring."
 },
 {
  "id": "dot-field",
  "name": "Dot Field",
  "description": "High-performance lightweight static Canvas dot matrix background with dynamic gradient coloring and responsive density scaling."
 },
 {
  "id": "dot-shader",
  "name": "Dot Shader",
  "description": "A GPU-accelerated interactive dot matrix background shader with magnetic cursor repulsion, proximity illumination glow, dynamic lens scaling, and ambient wave motion."
 },
 {
  "id": "drag-to-confirm",
  "name": "Drag to Confirm",
  "description": "A minimalist physical drag-to-confirm slider for high-stakes and destructive actions, equipped with progressive track fill physics, spring snapback resistance, full light/dark theme adaptation, and accessible keyboard controls."
 },
 {
  "id": "draw-checkbox",
  "name": "DrawCheckbox",
  "description": "A checkbox whose checkmark draws itself (path length animation) and settles with a tiny overshoot. The box scales from 0.9 -> 1.04 -> 1.0 for a tactile snap feel."
 },
 {
  "id": "dynamic-island",
  "name": "Dynamic Island",
  "description": "A physical morphing island component that smoothly transitions between a compact indicator, interactive summary, profile card, and social dock with spring physics."
 },
 {
  "id": "evil-eye",
  "name": "Evil Eye",
  "description": "A hanging navy amulet disc with concentric sky-blue and white rings that swings with realistic inertia in response to the pointer, painted as a layered SVG and driven by a single spring pipeline."
 },
 {
  "id": "expandable-data-row",
  "name": "Expandable Data Row",
  "description": "A polished table component with fluid accordion row unfolding, revealing deep metadata, audit activity feeds, and quick actions, with automatic card restructuring on mobile viewports."
 },
 {
  "id": "expandable-search",
  "name": "Expandable Search",
  "description": "A compact search pill that smoothly widens on focus with shortcut hint pills and clear button."
 },
 {
  "id": "faq",
  "name": "FAQ",
  "description": "An expandable accordion FAQ component with smooth spring height calculation, single/multi-open modes, category filtering, search, and full ARIA keyboard accessibility."
 },
 {
  "id": "floating-action-dock",
  "name": "Floating Action Dock",
  "description": "A floating quick-action toolbar inspired by macOS dock physics with smooth magnification and subtle tooltips."
 },
 {
  "id": "focus-mode",
  "name": "Focus Mode",
  "description": "An atmospheric focus-mode interaction that isolates selected cards or sections by smoothly dimming surrounding distractions with zero layout shift, tactile spring scaling, and Escape key dismissal."
 },
 {
  "id": "form",
  "name": "Form",
  "description": "A modular, composable form system with accessible inputs, textareas, custom selects, checkboxes, radio groups, switches, and animated validation messages."
 },
 {
  "id": "funnel-chart",
  "name": "Funnel Chart",
  "description": "A conversion funnel with per-stage widths, curved drop-off bridges, and a loss chip between every stage. An optional summary line reports overall conversion and the single biggest drop-off, all in hand-written SVG."
 },
 {
  "id": "glass-navbar",
  "name": "Glass Navbar",
  "description": "A modern, responsive glassmorphic navbar with smooth spring navigation pills, mobile menu drawer, and keyboard accessibility."
 },
 {
  "id": "glitch-text",
  "name": "Glitch Text",
  "description": "A multi-modal cybernetic glitch typography component featuring 5 distinct animation variants (RGB split chromatic aberration, cyberpunk clip-slicing, analog VHS tracking loss, matrix rune scramble decode, and electrical voltage surge)."
 },
 {
  "id": "glyph-matrix",
  "name": "Glyph Matrix",
  "description": "A high-performance, canvas-driven Matrix digital rain background effect featuring streaming Katakana and numeric glyphs, glowing head highlights, decaying phosphor trails, and interactive cursor disturbances."
 },
 {
  "id": "gooey-menu",
  "name": "Gooey Menu",
  "description": "A tactile liquid dropdown menu with organic SVG metaball fusion filter and spring-driven extrusion animation."
 },
 {
  "id": "gravity-particle-burst",
  "name": "Gravity Particle Burst",
  "description": "A pointer-triggered canvas particle burst with velocity, gravity, friction, and short-lived physical follow-through."
 },
 {
  "id": "hamburger-menu",
  "name": "Hamburger Menu",
  "description": "An iconic three-line menu toggle that transforms smoothly into a symmetrical close symbol."
 },
 {
  "id": "interactive-area-chart",
  "name": "Interactive Area Chart",
  "description": "A hand-written, dependency-free interactive SVG area chart with interruptible dataset morphing, Catmull-Rom spline resampling, scrubbing tooltip, and keyboard accessibility."
 },
 {
  "id": "interactive-timeline",
  "name": "Interactive Timeline",
  "description": "A developer-focused milestone and deployment timeline featuring dynamic progress lines, pulsating status nodes, expandable telemetry cards, and commit hash copy."
 },
 {
  "id": "intro-loader",
  "name": "Intro Loader",
  "description": "An Apple-inspired multilingual welcome splash and intro loader that rapidly cycles localized greetings with fluid blur transitions, progress tracking, and accessible skip controls."
 },
 {
  "id": "ios-search-bar",
  "name": "iOS-style Search Bar",
  "description": "A minimalist search pill that smoothly expands on focus and reveals quick-clear controls with spring animation."
 },
 {
  "id": "liquid-ripple-button",
  "name": "Liquid Ripple Button",
  "description": "A tactile button whose pointer-origin ripple and subtle wave layer make press feedback feel fluid."
 },
 {
  "id": "liquid-toggle",
  "name": "Liquid Toggle",
  "description": "A toggle with a liquid/blob-like transition. The internal shape deforms organically as it travels from off to on — stretching along the travel axis and settling into a natural blob shape rather than simply translating."
 },
 {
  "id": "live-line-chart",
  "name": "Live Line Chart",
  "description": "A real-time line chart that scrolls right-to-left, with a large current-value readout, a live delta, and a pause control. Hover or touch the chart to freeze the stream and scrub it with a crosshair tooltip."
 },
 {
  "id": "loader",
  "name": "Loader",
  "description": "A minimal, purpose-driven loading indicator with 4 calm, non-anxious motion variants."
 },
 {
  "id": "lock-input",
  "name": "LockInput",
  "description": "A text input whose focus state subtly \"locks\" into place — a focus ring scales in from the center and the border tweens to active, giving the impression that the input snaps closed on itself."
 },
 {
  "id": "login",
  "name": "Login",
  "description": "A production-ready authentication card built with the EasyUI form system, featuring password show/hide, remember me, validation states, and social logins."
 },
 {
  "id": "mac-os-folder-cards",
  "name": "macOS Folder Cards",
  "description": "An authentic porcelain-white macOS Finder folder icon that unrolls interactive cards with fluid Apple spring physics."
 },
 {
  "id": "magnetic-button",
  "name": "Magnetic Button",
  "description": "A responsive button with subtle proximity-based physics that pulls towards the cursor on hover and snaps back on departure."
 },
 {
  "id": "meteors",
  "name": "Meteors",
  "description": "A lightweight, highly aesthetic animated meteor shower effect that streams diagonal glowing celestial light beams across cards, badges, hero containers, and call-to-action sections."
 },
 {
  "id": "metric-hud",
  "name": "Metric HUD",
  "description": "An interactive developer telemetry card featuring hardware-accelerated SVG sparklines, pointer-scrubbing point inspection, spring-animated time range morphing, and delta indicators."
 },
 {
  "id": "money-card",
  "name": "Money Card",
  "description": "An interactive financial wallet card featuring animated live balance updates, quick-send contact shortcuts, recent transaction history, and responsive modal sheets for sending, receiving, and viewing activity."
 },
 {
  "id": "morphing-blob",
  "name": "Morphing Blob",
  "description": "An ambient, accessible SVG blob background that continuously morphs with spring physics and subtly follows the cursor for a fluid, interactive visual effect."
 },
 {
  "id": "morphing-button",
  "name": "Morphing Button",
  "description": "A layout-stable interactive action button that smoothly transitions between Idle, Loading, Success, and Error states without jarring jumps or dimension shifts."
 },
 {
  "id": "morphing-dialog",
  "name": "Morphing Dialog",
  "description": "An expandable card trigger that fluidly morphs into a centered dialog without jarring popup animations."
 },
 {
  "id": "morphing-icon",
  "name": "Morphing Icon",
  "description": "An animated micro-interaction wrapper that smoothly morphs between two icon states with coordinated rotation, scale, and cross-fade transitions."
 },
 {
  "id": "morphing-mega-menu",
  "name": "Morphing Mega Menu",
  "description": "A Stripe-inspired mega menu with a single continuous morphing panel that smoothly adapts its size, position, and arrow to any trigger."
 },
 {
  "id": "morphing-shape-loader",
  "name": "Morphing Shape Loader",
  "description": "A loading indicator that continuously morphs between configurable SVG shapes via real path interpolation. The transition is a genuine geometric morph — never a fade out / in."
 },
 {
  "id": "neon-edge-button",
  "name": "Neon Edge Button",
  "description": "A button with a restrained light source travelling around the border while the label remains primary."
 },
 {
  "id": "nimbu-mirchi",
  "name": "Nimbu Mirchi",
  "description": "A hanging lemon-and-green-chilli charm that swings with realistic inertia in response to the pointer, built from layered physical springs rather than a single rigid illustration."
 },
 {
  "id": "not-found",
  "name": "Not Found",
  "description": "A minimal, production-ready 404 / route error component featuring floating spring-physics proximity displacement on individual glyphs, clear typography hierarchy, and accessible recovery actions."
 },
 {
  "id": "notification-bell",
  "name": "Notification Bell",
  "description": "An interactive notification trigger with animated badge counter, arrival shake feedback, and dropdown panel."
 },
 {
  "id": "notification-stack",
  "name": "Notification Stack",
  "description": "A stacked notification card system with physical spring stacking elevation, swipe-to-dismiss drag, and simulation triggers."
 },
 {
  "id": "orbital-loading-ring",
  "name": "Orbital Loading Ring",
  "description": "A lightweight loading indicator with layered rings and orbiting particles that communicate active processing."
 },
 {
  "id": "origin-dropdown",
  "name": "OriginDropdown",
  "description": "A dropdown with origin-aware expansion — the menu materializes from the chosen side with a slight scale and an inward translation, so its perceived origin is the trigger edge closest to the menu."
 },
 {
  "id": "otp-input",
  "name": "OTP Input",
  "description": "An accessible one-time-passcode input made of auto-advancing digit boxes, each with a spring-driven pop animation on entry, built with Framer Motion and Tailwind CSS."
 },
 {
  "id": "package-box",
  "name": "Package Box",
  "description": "A pure CSS 3D cardboard package box featuring interactive tape-splitting physics, flap-folding choreography, and an animated packing slip that rises out and turns to face the viewer."
 },
 {
  "id": "particle-delete",
  "name": "Particle Delete",
  "description": "Premium physics-driven particle dissolution delete animation that rasterizes components into thousands of authentic tiny pixels and disperses them smoothly before state removal."
 },
 {
  "id": "payment-receipt-printer",
  "name": "Payment Receipt Printer",
  "description": "An animated payment and order receipt printer component for React featuring realistic thermal paper extrusion, chassis micro-vibration, customizable receipt itemization, and replay controls."
 },
 {
  "id": "payment-status",
  "name": "Payment Status",
  "description": "A calm, Apple-grade payment confirmation card with animated SVG path checkmark drawing, staged verification lifecycle transitions, receipt inspection, and failure recovery."
 },
 {
  "id": "peek-card",
  "name": "Peek Card",
  "description": "An origin-anchored contextual preview popover that emerges directly from target triggers on hover or tap with smart collision edge detection and rich metadata summaries."
 },
 {
  "id": "photo-box",
  "name": "Photo Box",
  "description": "Tactile Japanese stationery-inspired photo box featuring frosted glass translucency, sliding paper box mechanics, fanning polaroid prints, and full-bleed image zoom."
 },
 {
  "id": "pill-navigation",
  "name": "Pill Navigation",
  "description": "A restrained segmented navigation control with shared pill layout morphing and nested submenu dropdown support."
 },
 {
  "id": "press-button",
  "name": "PressButton",
  "description": "A button that compresses slightly on press and settles with a tiny natural overshoot for a tactile, physical feel."
 },
 {
  "id": "pricing",
  "name": "Pricing",
  "description": "A minimal two-tier pricing component for EasyUI. Native to the existing design system, fully theme-aware, with a quiet Free tier and a slightly more attractive Pro tier — without resorting to SaaS marketing tropes."
 },
 {
  "id": "product-tour",
  "name": "Product Tour",
  "description": "An interactive product walkthrough with spring-animated spotlight cutout, auto-scrolling targets, responsive bottom-sheet docking, and keyboard navigation."
 },
 {
  "id": "profile-card",
  "name": "Profile Card",
  "description": "A premium dark social profile card with a painted blue cover-art panel, action row, and a detail panel with avatar, verified name, bio, follower stats, and outbound website link."
 },
 {
  "id": "pull-to-refresh",
  "name": "Pull to Refresh",
  "description": "A physical pull-to-refresh component and container featuring realistic elastic resistance curves, smooth cubic bezier line chart visualization with interactive point scrubbing, high/low metrics, and seamless light & dark mode compatibility."
 },
 {
  "id": "rainbow-button",
  "name": "Rainbow Button",
  "description": "A vibrant button featuring an animated chromatic rainbow gradient border, dynamic 3D surface reflections, and an ambient blurred rainbow underglow."
 },
 {
  "id": "recovery-ledger",
  "name": "Recovery Ledger",
  "description": "An archival audit timeline and state recovery ledger with chronological snapshot markers, diff inspection, and one-click rollback triggers."
 },
 {
  "id": "reveal-card",
  "name": "Reveal Card",
  "description": "A high-definition product card with smooth cursor-driven 3D perspective rotation, dynamic glare, and revealed content."
 },
 {
  "id": "rocket-party-popper",
  "name": "Rocket Party Popper",
  "description": "An interactive black rocket launch that blasts into a colorful party popper confetti shower to reveal celebratory milestones."
 },
 {
  "id": "scroll-progress-nav",
  "name": "Scroll Progress Navigation",
  "description": "A floating table-of-contents navigation pill that tracks scroll depth, dynamically morphs between resting and floating states, highlights active sections, and enables smooth scrolling."
 },
 {
  "id": "scrollvelocitytext",
  "name": "Scroll Velocity Text",
  "description": "A direction-aware kinetic typography component that smoothly expands letter-spacing and scale on downward scroll, and winds back on upward scroll, with zero per-frame React re-renders."
 },
 {
  "id": "selection-basket",
  "name": "Selection Basket",
  "description": "A floating bulk-action toolbar that smoothly rises from the bottom of the screen when multiple dataset items are selected, supporting batch operations, horizontal scrolling, and clear triggers."
 },
 {
  "id": "settle-modal",
  "name": "SettleModal",
  "description": "A modal whose content has a tiny scale/settle instead of a generic fade. The panel scales 0.94 -> 1.02 -> 1.0 with a small y travel, then the inner content layers its own gentle settle on top."
 },
 {
  "id": "sheet",
  "name": "Sheet",
  "description": "A draggable sheet / drawer that slides in from any side and can be dragged away to dismiss — swipe left/right sheets anywhere on touch, top/bottom sheets via the grab handle. Springs back if you let go early."
 },
 {
  "id": "shooting-stars",
  "name": "Shooting Stars",
  "description": "A high-performance deep-space cosmos background featuring multi-depth twinkling celestial stars, glowing atmospheric nebula clouds, and cinematic shooting stars with luminous head flares, tapered fading trails, ember stardust, and click-to-summon interactivity."
 },
 {
  "id": "sidebar",
  "name": "Sidebar",
  "description": "A collapsible application sidebar with a hover pill that follows the cursor and a shared-layout active pill that glides between items. Includes nested sections, icon-only mode with tooltips, ⌘B toggle, and a draggable mobile drawer."
 },
 {
  "id": "sign-up",
  "name": "Sign Up",
  "description": "A comprehensive registration card with live password strength metrics, password confirmation matching, terms validation, and social onboarding."
 },
 {
  "id": "skeleton",
  "name": "Skeleton",
  "description": "Placeholder blocks with a subtle light sweep, text/avatar presets, and a SkeletonReveal container that eases real content in with a gentle rise and un-blur."
 },
 {
  "id": "slide-pagination",
  "name": "SlidePagination",
  "description": "A pagination control where the active indicator slides between pages rather than instantly switching. The active background uses shared layoutId so the indicator visibly travels from one item to the next."
 },
 {
  "id": "small-floating-dock",
  "name": "Small Floating Dock",
  "description": "A minimal, gesture-responsive floating dock for quick access to 3-5 primary actions."
 },
 {
  "id": "smart-comparison",
  "name": "Smart Comparison",
  "description": "An interactive feature matrix and SaaS tier comparison component featuring live difference filtering, collapsible specification categories, search indexing, and mobile card toggle."
 },
 {
  "id": "smooth-accordion",
  "name": "Smooth Accordion",
  "description": "An accordion component with physics height transition, rotating chevron indicators, and accessible keyboard toggles."
 },
 {
  "id": "sparkles-core",
  "name": "Sparkles Core",
  "description": "A high-performance, zero-dependency particle sparkle canvas with multi-shape geometry (circles, radiant diamond stars, cross starlets), organic twinkling, interactive cursor repulsion/attraction, click particle bursts, and fluid SSR safety."
 },
 {
  "id": "speed-warp",
  "name": "Speed Warp",
  "description": "A 3D perspective canvas starfield simulation that projects relativistic light streaks toward the viewer, creating an intense hyperspace or warp drive velocity effect."
 },
 {
  "id": "split-button",
  "name": "Split Button",
  "description": "A primary action fused with a chevron trigger that reveals related actions in a spring-timed dropdown, sharing a single pill silhouette."
 },
 {
  "id": "spotlight-card",
  "name": "Spotlight Card",
  "description": "A dark elevated surface that illuminates border and inner surfaces dynamically based on mouse pointer coordinates."
 },
 {
  "id": "spotlight-search",
  "name": "Spotlight Search",
  "description": "A global command palette and search overlay triggered by ⌘K featuring real-time fuzzy filtering, moving active highlight springs, kbd shortcuts, and full keyboard navigation."
 },
 {
  "id": "spring-select",
  "name": "SpringSelect",
  "description": "A select dropdown whose menu follows the trigger with a tiny spring. The chevron rotates a hair past 180° before settling, and the panel slides down with a subtle overshoot."
 },
 {
  "id": "stack-unfold-panel",
  "name": "Stack Unfold Panel",
  "description": "A vertically stacked card deck that unfolds progressively with spring physics, shifting adjacent panels with zero layout jank."
 },
 {
  "id": "stacked-cards",
  "name": "Stacked Cards",
  "description": "A responsive, scroll-driven stacking cards component built with Tailwind CSS and Framer Motion. Cards start aligned in a column and stack gracefully on scroll without hijacking page scrolling."
 },
 {
  "id": "stat-card",
  "name": "Stat Card",
  "description": "A KPI tile with a count-up headline number, a direction-aware delta pill, and a scrubable sparkline. Pair several with StatGrid for a responsive metrics row that works from phones to wide dashboards."
 },
 {
  "id": "stepper",
  "name": "Stepper",
  "description": "A multi-step progress indicator with line fills, gliding active rings, drawing checkmarks, and direction-aware sliding step panels."
 },
 {
  "id": "sticky-pages",
  "name": "Sticky Pages",
  "description": "A pure static full-page sticky stacking scroll component where pages slide up and stack cleanly one over another without any tilting or distortion, before releasing smoothly into natural page scrolling."
 },
 {
  "id": "story-card",
  "name": "Story Cards",
  "description": "A responsive, accessible story cards carousel for React applications built with Tailwind CSS and Framer Motion."
 },
 {
  "id": "stretch-switch",
  "name": "StretchSwitch",
  "description": "A toggle switch whose thumb stretches slightly while dragging or pressing, then snaps naturally to its destination via a snappy spring."
 },
 {
  "id": "text-scramble-decoder",
  "name": "Text Scramble Decoder",
  "description": "A controlled text reveal that resolves scrambled glyphs into readable copy without changing the text semantics."
 },
 {
  "id": "thinking-orb",
  "name": "Thinking Orb",
  "description": "Minimalist monochrome spherical particle vortex with orbital physics, pure black-and-white luminous styling, and 9 cognitive state deformations."
 },
 {
  "id": "torque-dial",
  "name": "Torque Dial",
  "description": "A rotational control dial with realistic physical angular momentum, velocity tracking, and exponential friction deceleration."
 },
 {
  "id": "typewriter-button",
  "name": "Typewriter Button",
  "description": "An interactive button that reveals its label character-by-character with optional synthesized mechanical audio feedback."
 },
 {
  "id": "undo-toast",
  "name": "Undo Toast",
  "description": "An advanced undo notification toast featuring an interactive progress countdown, pause-on-hover mechanics, action reversal animation, and versatile position anchoring."
 },
 {
  "id": "unfold-accordion",
  "name": "UnfoldAccordion",
  "description": "An accordion whose content unfolds with the chevron and spacing moving together. The chevron rotates 180° while the content height expands and the inner content slides up to close the gap, producing a single, fluid motion."
 },
 {
  "id": "velocity-toast",
  "name": "VelocityToast",
  "description": "A toast that enters with velocity and settles, with a progress indicator that responds naturally — pauses on hover, resumes with no jump, and eases slightly in the final 10% so dismissal feels intentional."
 },
 {
  "id": "wallet-balance",
  "name": "Wallet Balance",
  "description": "An interactive wallet balance component where branded cards tuck neatly into an embossed leather pouch with spring physics. Tap the eye button to reveal or mask balances with smooth blur-crossfade transitions."
 },
 {
  "id": "wallet-card",
  "name": "Wallet Card",
  "description": "A premium dark wallet card with a blue radial-gradient surface, live balance display, iOS-style toggle, and a primary action button. The card surface responds to the pointer with a soft cyan shine driven entirely by MotionValues."
 }
]

export const CATALOG_INDEX: CatalogEntry[] = RAW.map((r) => ({ ...r, category: MOTION.test(r.id) ? "Motion" : "Interface" }))
