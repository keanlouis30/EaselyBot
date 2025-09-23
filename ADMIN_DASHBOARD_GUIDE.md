# EaselyBot Admin Dashboard Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Implementation Steps](#implementation-steps)
6. [Security Considerations](#security-considerations)
7. [Deployment](#deployment)
8. [Future Enhancements](#future-enhancements)

## Overview

The EaselyBot Admin Dashboard is a web-based interface that allows administrators to:
- View and manage users
- Send broadcast announcements to all onboarded users
- Monitor bot activity and usage statistics
- View user engagement metrics
- Manage user subscriptions (free/premium)
- Access system logs and error reports
- Export data for analysis

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin Dashboard                         │
│                    (React/Next.js App)                      │
└─────────────┬───────────────────────────┬───────────────────┘
              │                           │
              ▼                           ▼
┌──────────────────────┐     ┌────────────────────────────────┐
│   Authentication     │     │      Dashboard API             │
│   (Supabase Auth)    │     │    (Express.js/Next.js)        │
└──────────────────────┘     └─────────────┬──────────────────┘
                                           │
                                           ▼
                            ┌──────────────────────────────┐
                            │     Supabase Database        │
                            │        PostgreSQL            │
                            └──────────────────────────────┘
                                           ▲
                                           │
                            ┌──────────────────────────────┐
                            │      EaselyBot Service       │
                            │   (Messenger Webhook)        │
                            └──────────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: Next.js 14 (React-based)
- **UI Components**: shadcn/ui or Material-UI
- **Styling**: Tailwind CSS
- **State Management**: Zustand or React Context
- **Charts**: Recharts or Chart.js
- **Tables**: TanStack Table (React Table v8)
- **Forms**: React Hook Form + Zod validation

### Backend
- **API**: Next.js API Routes or Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time Updates**: Supabase Realtime
- **File Storage**: Supabase Storage (for exports)

### Development Tools
- **TypeScript**: For type safety
- **ESLint & Prettier**: Code quality
- **Jest & React Testing Library**: Testing

## Project Structure

```
easely-admin/
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Landing/login page
│   │   ├── dashboard/
│   │   │   ├── page.tsx        # Dashboard home
│   │   │   ├── users/
│   │   │   │   ├── page.tsx    # Users list
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx # User details
│   │   │   ├── announcements/
│   │   │   │   ├── page.tsx    # Announcements
│   │   │   │   └── new/
│   │   │   │       └── page.tsx # Create announcement
│   │   │   ├── analytics/
│   │   │   │   └── page.tsx    # Analytics dashboard
│   │   │   └── settings/
│   │   │       └── page.tsx    # Admin settings
│   │   └── api/
│   │       ├── auth/           # Auth endpoints
│   │       ├── users/          # User management
│   │       ├── announcements/  # Broadcast messages
│   │       └── analytics/      # Stats endpoints
│   ├── components/
│   │   ├── ui/                 # UI components
│   │   ├── dashboard/          # Dashboard components
│   │   ├── charts/             # Chart components
│   │   └── tables/             # Table components
│   ├── lib/
│   │   ├── supabase/          # Supabase client
│   │   ├── utils/             # Utility functions
│   │   └── hooks/             # Custom React hooks
│   ├── types/                 # TypeScript types
│   └── styles/                # Global styles
├── public/                    # Static assets
├── tests/                     # Test files
├── .env.local                 # Environment variables
├── next.config.js             # Next.js configuration
├── tailwind.config.js         # Tailwind configuration
├── tsconfig.json              # TypeScript configuration
└── package.json               # Dependencies
```

## Implementation Steps

### Step 1: Initialize the Next.js Project

```bash
# Create new Next.js app with TypeScript and Tailwind
npx create-next-app@latest easely-admin --typescript --tailwind --app --src-dir --import-alias "@/*"

cd easely-admin

# Install additional dependencies
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm install recharts react-hook-form @hookform/resolvers zod
npm install @tanstack/react-table date-fns
npm install lucide-react class-variance-authority clsx tailwind-merge
npm install --save-dev @types/node
```

### Step 2: Configure Supabase Client

Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
ENCRYPTION_KEY=your_encryption_key
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

Create `src/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

Create `src/lib/supabase/server.ts`:
```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.delete(name)
        },
      },
    }
  )
}
```

### Step 3: Set Up Authentication

Create `src/app/layout.tsx`:
```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'EaselyBot Admin Dashboard',
  description: 'Manage your EaselyBot users and settings',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

Create `src/app/page.tsx` (Login page):
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      router.push('/dashboard')
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            EaselyBot Admin Dashboard
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to manage your bot
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

### Step 4: Create Dashboard Layout

Create `src/app/dashboard/layout.tsx`:
```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardNav } from '@/components/dashboard/nav'
import { UserMenu } from '@/components/dashboard/user-menu'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white">
        <div className="p-4">
          <h1 className="text-2xl font-bold">EaselyBot</h1>
        </div>
        <DashboardNav />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="flex justify-between items-center px-6 py-4">
            <h2 className="text-xl font-semibold">Admin Dashboard</h2>
            <UserMenu user={user} />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

### Step 5: Create Users Management Page

Create `src/app/dashboard/users/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { UsersTable } from '@/components/dashboard/users-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import crypto from 'crypto'

async function decryptToken(encryptedToken: string | null): Promise<string | null> {
  if (!encryptedToken) return null
  
  try {
    const algorithm = 'aes-256-cbc'
    const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')
    const [ivHex, encrypted] = encryptedToken.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const decipher = crypto.createDecipheriv(algorithm, key, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (error) {
    console.error('Failed to decrypt token:', error)
    return null
  }
}

export default async function UsersPage() {
  const supabase = await createClient()
  
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching users:', error)
  }

  // Process users to decrypt tokens (do not send to client)
  const processedUsers = users?.map(user => ({
    ...user,
    canvas_token: user.canvas_token ? '***encrypted***' : null,
    has_token: !!user.canvas_token
  })) || []

  // Get statistics
  const totalUsers = users?.length || 0
  const onboardedUsers = users?.filter(u => u.is_onboarded).length || 0
  const premiumUsers = users?.filter(u => u.subscription_tier === 'premium').length || 0
  const activeToday = users?.filter(u => {
    const lastActive = new Date(u.last_activity || 0)
    const today = new Date()
    return lastActive.toDateString() === today.toDateString()
  }).length || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Users</h1>
        <p className="text-gray-600">Manage and view all EaselyBot users</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Users</CardDescription>
            <CardTitle className="text-3xl">{totalUsers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Onboarded</CardDescription>
            <CardTitle className="text-3xl">{onboardedUsers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Premium</CardDescription>
            <CardTitle className="text-3xl">{premiumUsers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Today</CardDescription>
            <CardTitle className="text-3xl">{activeToday}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Click on a user to view detailed information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsersTable users={processedUsers} />
        </CardContent>
      </Card>
    </div>
  )
}
```

### Step 6: Create Announcements Page

Create `src/app/dashboard/announcements/page.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Send, Users, UserCheck, Crown } from 'lucide-react'

export default function AnnouncementsPage() {
  const [message, setMessage] = useState('')
  const [targetAudience, setTargetAudience] = useState('all_onboarded')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<any>(null)
  const router = useRouter()

  const handleSendAnnouncement = async () => {
    setLoading(true)
    setSuccess(false)
    setError(null)

    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          target_audience: targetAudience,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send announcement')
      }

      const data = await response.json()
      setStats(data.stats)
      setSuccess(true)
      setMessage('')
      
      // Log the broadcast
      await fetch('/api/activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          activity_type: 'broadcast_sent',
          details: {
            message: message.substring(0, 100),
            audience: targetAudience,
            recipients_count: data.stats.sent,
          },
        }),
      })
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Announcements</h1>
        <p className="text-gray-600">Send broadcast messages to your users</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compose Announcement */}
        <Card>
          <CardHeader>
            <CardTitle>Compose Announcement</CardTitle>
            <CardDescription>
              Create and send a message to your users
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="audience">Target Audience</Label>
              <Select value={targetAudience} onValueChange={setTargetAudience}>
                <SelectTrigger id="audience">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_onboarded">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      All Onboarded Users
                    </div>
                  </SelectItem>
                  <SelectItem value="premium">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4" />
                      Premium Users Only
                    </div>
                  </SelectItem>
                  <SelectItem value="free">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Free Users Only
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Type your announcement here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="resize-none"
                maxLength={2000}
              />
              <p className="text-sm text-gray-500">
                {message.length}/2000 characters
              </p>
            </div>

            {success && (
              <Alert className="bg-green-50 border-green-200">
                <AlertDescription className="text-green-800">
                  Announcement sent successfully! 
                  {stats && ` Delivered to ${stats.sent} users.`}
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert className="bg-red-50 border-red-200">
                <AlertDescription className="text-red-800">
                  Error: {error}
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleSendAnnouncement}
              disabled={!message || loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send Announcement
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Recent Broadcasts */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Broadcasts</CardTitle>
            <CardDescription>
              History of sent announcements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BroadcastHistory />
          </CardContent>
        </Card>
      </div>

      {/* Message Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Message Preview</CardTitle>
          <CardDescription>
            How your message will appear in Messenger
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-100 rounded-lg p-4 max-w-md">
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <p className="text-sm font-medium text-gray-900">EaselyBot</p>
              <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                {message || 'Your message will appear here...'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function BroadcastHistory() {
  // This would fetch from your database
  const [broadcasts, setBroadcasts] = useState<any[]>([])
  
  // Fetch broadcast history
  useEffect(() => {
    fetch('/api/announcements/history')
      .then(res => res.json())
      .then(data => setBroadcasts(data))
  }, [])

  return (
    <div className="space-y-3">
      {broadcasts.length === 0 ? (
        <p className="text-sm text-gray-500">No broadcasts sent yet</p>
      ) : (
        broadcasts.map((broadcast) => (
          <div key={broadcast.id} className="border rounded-lg p-3">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-sm text-gray-700 line-clamp-2">
                  {broadcast.message}
                </p>
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  <span>{broadcast.target_audience}</span>
                  <span>{broadcast.recipients_count} recipients</span>
                  <span>{new Date(broadcast.sent_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
```

### Step 7: Create API Endpoints

Create `src/app/api/announcements/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendMessengerMessage } from '@/lib/messenger'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify admin authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { message, target_audience } = await request.json()

    // Build query based on target audience
    let query = supabase.from('users').select('sender_id, subscription_tier')
    
    if (target_audience === 'all_onboarded') {
      query = query.eq('is_onboarded', true)
    } else if (target_audience === 'premium') {
      query = query.eq('is_onboarded', true).eq('subscription_tier', 'premium')
    } else if (target_audience === 'free') {
      query = query.eq('is_onboarded', true).eq('subscription_tier', 'free')
    }

    const { data: users, error } = await query

    if (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    // Send messages to each user
    let sent = 0
    let failed = 0

    for (const user of users || []) {
      try {
        await sendMessengerMessage(user.sender_id, message)
        sent++
      } catch (error) {
        console.error(`Failed to send to ${user.sender_id}:`, error)
        failed++
      }
    }

    // Log the broadcast
    await supabase.from('broadcast_messages').insert({
      message,
      target_audience,
      recipients_count: sent,
      sent_by: user.id,
      status: 'completed',
    })

    return NextResponse.json({
      success: true,
      stats: {
        sent,
        failed,
        total: users?.length || 0,
      },
    })
  } catch (error) {
    console.error('Error sending announcement:', error)
    return NextResponse.json(
      { error: 'Failed to send announcement' },
      { status: 500 }
    )
  }
}
```

Create `src/lib/messenger.ts`:
```typescript
export async function sendMessengerMessage(recipientId: string, message: string) {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN

  const response = await fetch(
    `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Messenger API error: ${JSON.stringify(error)}`)
  }

  return response.json()
}
```

### Step 8: Create Analytics Dashboard

Create `src/app/dashboard/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Overview } from '@/components/dashboard/overview'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { UserGrowth } from '@/components/dashboard/user-growth'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch statistics
  const { data: users } = await supabase
    .from('users')
    .select('created_at, is_onboarded, subscription_tier, last_activity')

  const { data: tasks } = await supabase
    .from('tasks')
    .select('created_at, status')

  const { data: recentActivity } = await supabase
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  // Calculate metrics
  const totalUsers = users?.length || 0
  const onboardedUsers = users?.filter(u => u.is_onboarded).length || 0
  const premiumUsers = users?.filter(u => u.subscription_tier === 'premium').length || 0
  const totalTasks = tasks?.length || 0
  const completedTasks = tasks?.filter(t => t.status === 'completed').length || 0
  
  // Calculate growth rate (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const newUsersLast30Days = users?.filter(u => 
    new Date(u.created_at) > thirtyDaysAgo
  ).length || 0
  const growthRate = totalUsers > 0 ? (newUsersLast30Days / totalUsers * 100).toFixed(1) : '0'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600">Welcome to your EaselyBot admin dashboard</p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              +{growthRate}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Onboarded Users</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onboardedUsers}</div>
            <p className="text-xs text-muted-foreground">
              {((onboardedUsers / totalUsers) * 100).toFixed(1)}% of total users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Premium Users</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{premiumUsers}</div>
            <p className="text-xs text-muted-foreground">
              ${premiumUsers * 10} MRR (estimated)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks Created</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M9 11l3 3 8-8" />
              <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTasks}</div>
            <p className="text-xs text-muted-foreground">
              {completedTasks} completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Activity */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>User Growth</CardTitle>
            <CardDescription>
              New user registrations over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserGrowth users={users || []} />
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest user interactions and system events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecentActivity activities={recentActivity || []} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>
            Daily active users for the last 7 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Overview users={users || []} />
        </CardContent>
      </Card>
    </div>
  )
}
```

## Security Considerations

### 1. Authentication & Authorization
- Use Supabase Auth with email/password or OAuth providers
- Implement role-based access control (RBAC)
- Create admin users table with specific permissions
- Use Row Level Security (RLS) in Supabase

### 2. API Security
- Validate all inputs
- Use HTTPS only
- Implement rate limiting
- Add CSRF protection
- Sanitize user data before display

### 3. Database Security
- Never expose encryption keys to client
- Use parameterized queries
- Implement audit logging
- Regular backups

### 4. Environment Variables
```env
# Add to .env.local for admin dashboard
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key  # Server-side only
ENCRYPTION_KEY=your_encryption_key      # Server-side only
PAGE_ACCESS_TOKEN=your_fb_page_token   # Server-side only
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## Deployment

### Deploy to Vercel (Recommended for Next.js)

1. **Push to GitHub**:
```bash
git init
git add .
git commit -m "Initial admin dashboard"
git remote add origin your-repo-url
git push -u origin main
```

2. **Deploy with Vercel**:
```bash
npm install -g vercel
vercel
```

3. **Configure Environment Variables**:
- Go to Vercel Dashboard
- Add all environment variables from `.env.local`
- Redeploy

### Deploy to Render

1. **Create `render.yaml`**:
```yaml
services:
  - type: web
    name: easely-admin
    runtime: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_VERSION
        value: 18.17.0
      - key: NEXT_PUBLIC_SUPABASE_URL
        sync: false
      - key: NEXT_PUBLIC_SUPABASE_ANON_KEY
        sync: false
      - key: SUPABASE_SERVICE_KEY
        sync: false
      - key: ENCRYPTION_KEY
        sync: false
      - key: PAGE_ACCESS_TOKEN
        sync: false
```

2. **Deploy**:
- Connect GitHub repository
- Render will auto-deploy on push

## Future Enhancements

### 1. Advanced Analytics
- User engagement metrics
- Task completion rates
- Canvas integration statistics
- Revenue tracking for premium users
- Cohort analysis

### 2. User Management Features
- Bulk user actions
- User impersonation for debugging
- Export user data
- Manual subscription management
- User communication history

### 3. Content Management
- Template messages
- Scheduled announcements
- A/B testing for messages
- Multi-language support
- Rich media in announcements

### 4. System Management
- Error monitoring dashboard
- Performance metrics
- API usage tracking
- Webhook status monitoring
- Database optimization tools

### 5. Automation
- Auto-responses for common queries
- Automated user onboarding analysis
- Intelligent user segmentation
- Predictive analytics for churn

### 6. Integration Features
- Canvas API monitoring
- Facebook Messenger analytics
- Payment provider integration (Ko-fi/Stripe)
- Email notifications for admins
- Slack/Discord alerts

### 7. Security Enhancements
- Two-factor authentication
- IP whitelisting
- Audit logs with detailed tracking
- Data encryption at rest
- GDPR compliance tools

## Testing

### Unit Tests
```typescript
// Example test for user fetching
describe('Users API', () => {
  it('should fetch all users', async () => {
    const response = await fetch('/api/users')
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
  })
})
```

### E2E Tests
```typescript
// Example Playwright test
test('admin can send announcement', async ({ page }) => {
  await page.goto('/dashboard/announcements')
  await page.fill('#message', 'Test announcement')
  await page.click('button:has-text("Send Announcement")')
  await expect(page.locator('.alert')).toContainText('success')
})
```

## Monitoring

### Set up monitoring with:
- **Vercel Analytics**: Built-in performance monitoring
- **Sentry**: Error tracking
- **LogRocket**: Session replay
- **Supabase Dashboard**: Database monitoring

## Support & Maintenance

### Regular Tasks
1. Monitor error logs weekly
2. Review user feedback
3. Update dependencies monthly
4. Backup database regularly
5. Review security alerts

### Documentation
- Keep API documentation updated
- Document new features
- Maintain changelog
- Create user guides for admins

This admin dashboard provides a comprehensive solution for managing your EaselyBot users, sending announcements, and monitoring system health. The modular architecture allows for easy expansion and customization based on your specific needs.
