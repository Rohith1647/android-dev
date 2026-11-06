# Release Notes - Roundtable Internal Chat (Week 3)

## Features & Improvements
- **Real-time Messaging:** Implemented and integrated real-time STOMP WebSockets for instant message delivery without manual refresh.
- **Typing Indicators & Read Receipts:** Added real-time indicators for typing status and read receipts (sent/delivered/read) for a seamless chat experience.
- **Message Pagination:** Implemented infinite scrolling to automatically fetch older messages as the user scrolls up.
- **Unread Badges:** Chat lists now feature live-updating unread badges that increment as new messages arrive in the background.
- **Accessibility Enhancements:** Complete accessibility pass on Login and Chat components, introducing comprehensive `aria-` label tagging, ARIA live regions for typing indicators, and better support for screen readers.

## Known Issues / Incomplete Tasks
- **Admin/HR Panels:** The search and pagination functionality for the user management tables has not yet been integrated.
- **Group Chat Management:** The functionality to add participants to existing group chats (for Admin/HR/Employee roles) is currently missing from the frontend interface.

## Technical Details
- Added role-based client-side routing to properly direct Admin, HR, Employee, and Student users.
- Lint and build verified (`oxlint` and `vite build` completed with zero errors).
- Cross-browser (Chrome, Firefox, Safari) and Staging deployment checks pending final QA sign-off.
