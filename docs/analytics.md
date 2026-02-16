# Analytics Documentation

This document covers the analytics implementation in wrapshoot, including event tracking, user identification, and the feedback system.

## Overview

We use [PostHog](https://posthog.com) for product analytics. PostHog provides:
- Event tracking (pageviews, user actions)
- User identification and profiles
- Surveys and feedback collection
- DAU/WAU/MAU metrics
- Retention and funnel analysis

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js App                               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   PostHogProvider                         │   │
│  │            (components/providers/posthog-provider.tsx)    │   │
│  │                                                           │   │
│  │  - Initializes PostHog on app load                       │   │
│  │  - Identifies users via Supabase auth                    │   │
│  │  - Captures pageviews automatically                      │   │
│  │                                                           │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │              PostHogAuthWrapper                      │ │   │
│  │  │                                                      │ │   │
│  │  │  - Listens for Supabase auth changes                │ │   │
│  │  │  - Calls posthog.identify() on sign-in              │ │   │
│  │  │  - Calls posthog.reset() on sign-out                │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Analytics Helper Functions                   │   │
│  │                 (lib/analytics/posthog.ts)                │   │
│  │                                                           │   │
│  │  trackProjectCreated()    trackSceneCreated()            │   │
│  │  trackProjectViewed()     trackShootingDayCreated()      │   │
│  │  trackFeatureUsed()       trackError()                   │   │
│  │  ...                                                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   FeedbackButton                          │   │
│  │            (components/feedback/feedback-button.tsx)      │   │
│  │                                                           │   │
│  │  - Custom UI modal in sidebar                            │   │
│  │  - Sends responses to PostHog surveys                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS (posthog-js)
                              ▼
                 ┌─────────────────────────┐
                 │      PostHog Cloud      │
                 │   (us.i.posthog.com)    │
                 │                         │
                 │  - Event ingestion      │
                 │  - User profiles        │
                 │  - Dashboards           │
                 │  - Surveys              │
                 └─────────────────────────┘
```

## Configuration

### Environment Variables

Add these to `apps/web/.env.local`:

```bash
# PostHog Analytics
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxxxxxxx      # Your PostHog project API key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com  # PostHog host (US or EU)
NEXT_PUBLIC_POSTHOG_SURVEY_ID=019xxxxx-xxxx-xxxx   # Feedback survey ID
```

### PostHog Initialization

The PostHog provider is initialized in `app/layout.tsx`:

```tsx
import { PostHogProvider } from "@/components/providers/posthog-provider";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <PostHogProvider>
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
```

### Provider Options

In `components/providers/posthog-provider.tsx`:

```typescript
posthog.init(key, {
  api_host: "https://us.i.posthog.com",
  person_profiles: "identified_only",  // Only create profiles for identified users
  capture_pageview: true,              // Auto-capture pageviews
  capture_pageleave: true,             // Track when users leave
  disable_surveys: true,               // We use custom survey UI
});
```

## User Identification

Users are automatically identified when they sign in via Supabase:

```typescript
// In PostHogAuthWrapper
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_IN" && session?.user) {
    posthog.identify(session.user.id, {
      email: session.user.email,
      name: session.user.user_metadata?.name,
      created_at: session.user.created_at,
    });
  } else if (event === "SIGNED_OUT") {
    posthog.reset();  // Clear user identity
  }
});
```

### User Properties

| Property | Source | Description |
|----------|--------|-------------|
| `$user_id` | Supabase auth | Unique user identifier |
| `email` | Supabase auth | User's email address |
| `name` | User metadata | Display name |
| `created_at` | Supabase auth | Account creation date |

## Event Tracking

### Automatic Events

These events are captured automatically by PostHog:

| Event | Description |
|-------|-------------|
| `$pageview` | Page load/navigation |
| `$pageleave` | User leaves a page |
| `$autocapture` | Clicks, form submissions (if enabled) |

### Custom Events

#### Project Events

```typescript
import { trackProjectCreated, trackProjectViewed } from "@/lib/analytics/posthog";

// When a project is created
trackProjectCreated(project.id, project.name);

// When a project page is viewed
trackProjectViewed(project.id, project.name);
```

#### Scene Events

```typescript
import { trackSceneCreated } from "@/lib/analytics/posthog";

trackSceneCreated(projectId, sceneId);
```

#### Shooting Day Events

```typescript
import { trackShootingDayCreated } from "@/lib/analytics/posthog";

trackShootingDayCreated(projectId, shootingDayId);
```

#### Feature Usage

```typescript
import { trackFeatureUsed } from "@/lib/analytics/posthog";

// Track any feature usage
trackFeatureUsed("stripeboard_drag", { scene_count: 5 });
trackFeatureUsed("script_upload");
trackFeatureUsed("ai_breakdown");
```

#### Error Tracking

```typescript
import { trackError } from "@/lib/analytics/posthog";

trackError("api_failure", { endpoint: "/api/scenes", status: 500 });
```

### Complete Event Reference

| Event | Properties | Triggered When |
|-------|------------|----------------|
| `project_created` | `project_id`, `project_name` | User creates a new project |
| `project_viewed` | `project_id`, `project_name` | User opens a project |
| `scene_created` | `project_id`, `scene_id` | User adds a scene |
| `shooting_day_created` | `project_id`, `shooting_day_id` | User adds a shooting day |
| `crew_added` | `project_id`, `role` | User adds a crew member |
| `cast_added` | `project_id` | User adds a cast member |
| `budget_created` | `project_id`, `budget_id` | User creates a budget |
| `expense_added` | `budget_id`, `amount`, `category` | User logs an expense |
| `script_uploaded` | `project_id` | User uploads a script |
| `feature_used` | `feature`, `...metadata` | User uses a specific feature |
| `error_occurred` | `error`, `...context` | An error occurs |
| `subscription_started` | `plan` | User subscribes |
| `subscription_cancelled` | `plan` | User cancels subscription |
| `share_modal_opened` | - | User opens share modal |
| `share_link_copied` | - | User copies share link |
| `share_email_sent` | `has_message` | User sends share invite email |
| `survey shown` | `$survey_id` | Feedback modal opened |
| `survey sent` | `$survey_id`, `feedback_type`, `message` | Feedback submitted |

## Adding New Events

### 1. Add Helper Function

In `lib/analytics/posthog.ts`:

```typescript
export function trackMyNewEvent(param1: string, param2: number) {
  posthog.capture("my_new_event", {
    param1: param1,
    param2: param2,
  });
}
```

### 2. Use in Component

```typescript
import { trackMyNewEvent } from "@/lib/analytics/posthog";

function MyComponent() {
  const handleAction = () => {
    // Do something...
    trackMyNewEvent("value1", 42);
  };
}
```

### Best Practices

1. **Use snake_case** for event names: `project_created`, not `projectCreated`
2. **Include context**: Always include relevant IDs (project_id, user actions)
3. **Don't track PII**: Avoid tracking sensitive data in event properties
4. **Track outcomes, not clicks**: `scene_created` is better than `create_scene_button_clicked`

## Feedback System

### How It Works

1. User clicks "Feedback" button (available in multiple locations)
2. Custom modal appears (not PostHog's default UI)
3. User selects type (Feature Request, Bug Report, General)
4. User writes message and submits
5. Event sent to PostHog with survey ID

### Feedback Button Locations

The feedback button appears in three places:

| Location | Component | Variant |
|----------|-----------|---------|
| Main sidebar (project view) | `Sidebar` | `sidebar` (dark theme) |
| Project picker header | `page.tsx` | `header` (compact) |
| Settings sidebar | `SettingsLayout` | `default` (light theme) |

### Feedback Button Variants

```tsx
// Dark sidebar (default)
<FeedbackButton />
<FeedbackButton variant="sidebar" />

// Light theme settings page
<FeedbackButton variant="default" />

// Header button (compact)
<FeedbackButton variant="header" />

// Collapsed sidebar (icon only)
<FeedbackButton collapsed />
```

### Timed Survey

A feedback survey automatically appears after 5 minutes of app usage:

- **Trigger**: 5 minutes after first page load (tracked via localStorage)
- **Shown once**: Uses `timed-survey-shown` localStorage key
- **Survey ID**: `NEXT_PUBLIC_POSTHOG_EVERYUSER_SURVEY_ID`
- **Component**: `components/feedback/timed-survey.tsx`
- **Loaded in**: `AppShell` component

Events tracked:
- `survey shown` with `survey_type: "timed_prompt"`
- `survey sent` with `survey_type: "timed_prompt"`
- `survey dismissed` when user clicks "Maybe later"

To change the delay, modify `SURVEY_DELAY_MS` in `timed-survey.tsx`:
```typescript
const SURVEY_DELAY_MS = 5 * 60 * 1000; // 5 minutes
```

### Implementation

The feedback button in `components/feedback/feedback-button.tsx`:

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  posthog.capture("survey sent", {
    $survey_id: surveyId,           // Links to PostHog survey
    $survey_response: message,       // Main response text
    $survey_response_1: feedbackType, // Type selection
    feedback_type: feedbackType,     // Also as custom property
    message: message,
  });
};
```

### Viewing Feedback

1. Go to PostHog dashboard
2. Navigate to **Surveys** → **Product Feedback**
3. Click **Results** tab
4. View all submissions with user info

## PostHog Dashboard Setup

### Creating DAU/WAU/MAU Insights

1. Go to **Insights** → **New insight**
2. Select **Trends**
3. Event: `$pageview` (or "All events")
4. Change "Total count" to **Unique users**
5. For WAU: Group by **Week**
6. For MAU: Group by **Month**
7. Save to dashboard

### Recommended Dashboards

#### Product Analytics
- Daily Active Users (DAU)
- Weekly Active Users (WAU)
- Monthly Active Users (MAU)
- New vs Returning Users

#### Feature Adoption
- Projects created per day
- Scenes created per day
- Feature usage breakdown

#### User Retention
- Retention curve (Retention insight)
- Churn analysis

### Creating Actions

Actions group events for easier analysis:

1. Go to **Data Management** → **Actions**
2. Click **New action**
3. Select **Custom event**
4. Match events by name pattern

Example: "Project Activity" action matching:
- `project_created`
- `project_viewed`
- `scene_created`
- `shooting_day_created`

## Debugging

### Development Mode

In development, PostHog runs in debug mode. Check browser console for:

```
[PostHog.js] send "project_viewed" {uuid: '...', event: 'project_viewed', properties: {...}}
```

### Verify Events

1. Open browser DevTools → **Network** tab
2. Filter by `posthog`
3. Look for requests to `us.i.posthog.com`
4. Check request payload for your events

### Common Issues

| Issue | Solution |
|-------|----------|
| Events not appearing | Check env vars are in `apps/web/.env.local` |
| User not identified | Verify Supabase auth is working |
| Survey popup showing | Set `disable_surveys: true` in config |
| Events delayed | PostHog has ~1 min ingestion delay |

## Share Feature

The share feature allows users to invite friends via email.

### Components

- **ShareButton**: `components/share/share-button.tsx`
- **API Endpoint**: `app/api/share/route.ts`

### How It Works

1. User clicks "Share" button
2. Modal opens with:
   - Copy link option (copies landing page URL)
   - Email invite form with optional personal message
3. Email sent via Resend API
4. Events tracked in PostHog

### Email Template

The share email includes:
- Sender's name (from UserProfile)
- Personal message (if provided)
- Feature highlights
- CTA button to landing page

### Share Button Locations

| Location | Variant |
|----------|---------|
| Main sidebar | `sidebar` |
| Project sidebar | `default` |
| Settings sidebar | `default` |
| Project picker header | `header` |

## File Structure

```
apps/web/
├── app/
│   └── api/
│       └── share/
│           └── route.ts             # Share email API endpoint
├── components/
│   ├── providers/
│   │   └── posthog-provider.tsx     # PostHog initialization & user identification
│   ├── feedback/
│   │   ├── feedback-button.tsx      # Feedback modal component
│   │   └── timed-survey.tsx         # Auto-popup survey after 5 minutes
│   └── share/
│       └── share-button.tsx         # Share with friends component
├── lib/
│   └── analytics/
│       └── posthog.ts               # Event tracking helper functions
└── .env.local                       # PostHog API keys
```

## Security Considerations

1. **API Key**: The `NEXT_PUBLIC_POSTHOG_KEY` is a publishable key, safe for client-side
2. **No PII in events**: Don't include passwords, full addresses, or sensitive data
3. **User consent**: Consider adding cookie consent for GDPR compliance
4. **Data retention**: Configure in PostHog dashboard under Settings

## Resources

- [PostHog Documentation](https://posthog.com/docs)
- [PostHog React SDK](https://posthog.com/docs/libraries/react)
- [PostHog Surveys](https://posthog.com/docs/surveys)
- [PostHog Insights](https://posthog.com/docs/product-analytics/insights)
