export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          pseudo: string
          bio: string | null
          avatar_url: string | null
          pole: 'anime' | 'manga' | 'gaming' | 'danse' | 'k-drama' | 'culture'
          role: 'admin' | 'moderator' | 'member' | 'guest'
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          pseudo: string
          bio?: string | null
          avatar_url?: string | null
          pole: 'anime' | 'manga' | 'gaming' | 'danse' | 'k-drama' | 'culture'
          role?: 'admin' | 'moderator' | 'member' | 'guest'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          pseudo?: string
          bio?: string | null
          avatar_url?: string | null
          pole?: 'anime' | 'manga' | 'gaming' | 'danse' | 'k-drama' | 'culture'
          role?: 'admin' | 'moderator' | 'member' | 'guest'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      community_members: {
        Row: {
          id: string
          user_id: string
          pole: 'anime' | 'manga' | 'gaming' | 'danse' | 'k-drama' | 'culture'
          level: 'novice' | 'member' | 'veteran' | 'elite'
          ranking: number
          points: number
          joined_at: string
          last_activity_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          pole: 'anime' | 'manga' | 'gaming' | 'danse' | 'k-drama' | 'culture'
          level?: 'novice' | 'member' | 'veteran' | 'elite'
          ranking?: number
          points?: number
          joined_at?: string
          last_activity_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          pole?: 'anime' | 'manga' | 'gaming' | 'danse' | 'k-drama' | 'culture'
          level?: 'novice' | 'member' | 'veteran' | 'elite'
          ranking?: number
          points?: number
          joined_at?: string
          last_activity_at?: string | null
        }
      }
      events: {
        Row: {
          id: string
          title: string
          description: string
          location: string
          pole: 'anime' | 'manga' | 'gaming' | 'danse' | 'k-drama' | 'culture' | 'tous'
          organizer_id: string
          start_date: string
          end_date: string
          max_attendees: number | null
          attendee_count: number
          image_url: string | null
          is_free: boolean
          price: number | null
          status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description: string
          location: string
          pole: 'anime' | 'manga' | 'gaming' | 'danse' | 'k-drama' | 'culture' | 'tous'
          organizer_id: string
          start_date: string
          end_date: string
          max_attendees?: number | null
          attendee_count?: number
          image_url?: string | null
          is_free?: boolean
          price?: number | null
          status?: 'upcoming' | 'ongoing' | 'completed' | 'cancelled'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          location?: string
          pole?: 'anime' | 'manga' | 'gaming' | 'danse' | 'k-drama' | 'culture' | 'tous'
          organizer_id?: string
          start_date?: string
          end_date?: string
          max_attendees?: number | null
          attendee_count?: number
          image_url?: string | null
          is_free?: boolean
          price?: number | null
          status?: 'upcoming' | 'ongoing' | 'completed' | 'cancelled'
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          description: string
          category: 'figurines' | 'manga' | 'goodies' | 'vetements' | 'autre'
          price: number
          stock: number
          image_url: string | null
          seller_id: string
          whatsapp_number: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description: string
          category: 'figurines' | 'manga' | 'goodies' | 'vetements' | 'autre'
          price: number
          stock?: number
          image_url?: string | null
          seller_id: string
          whatsapp_number: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          category?: 'figurines' | 'manga' | 'goodies' | 'vetements' | 'autre'
          price?: number
          stock?: number
          image_url?: string | null
          seller_id?: string
          whatsapp_number?: string
          created_at?: string
          updated_at?: string
        }
      }
      community_posts: {
        Row: {
          id: string
          author_id: string
          pole: 'anime' | 'manga' | 'gaming' | 'danse' | 'k-drama' | 'culture'
          content: string
          image_urls: string[]
          likes_count: number
          comments_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          author_id: string
          pole: 'anime' | 'manga' | 'gaming' | 'danse' | 'k-drama' | 'culture'
          content: string
          image_urls?: string[]
          likes_count?: number
          comments_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          author_id?: string
          pole?: 'anime' | 'manga' | 'gaming' | 'danse' | 'k-drama' | 'culture'
          content?: string
          image_urls?: string[]
          likes_count?: number
          comments_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      event_attendees: {
        Row: {
          id: string
          event_id: string
          user_id: string
          status: 'registered' | 'attended' | 'cancelled'
          registered_at: string
        }
        Insert: {
          id?: string
          event_id: string
          user_id: string
          status?: 'registered' | 'attended' | 'cancelled'
          registered_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          user_id?: string
          status?: 'registered' | 'attended' | 'cancelled'
          registered_at?: string
        }
      }
      post_likes: {
        Row: {
          id: string
          post_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          user_id?: string
          created_at?: string
        }
      }
      post_comments: {
        Row: {
          id: string
          post_id: string
          author_id: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          post_id: string
          author_id: string
          content: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          author_id?: string
          content?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {}
    Functions: {}
    Enums: {
      user_role: 'admin' | 'moderator' | 'member' | 'guest'
      user_pole: 'anime' | 'manga' | 'gaming' | 'danse' | 'k-drama' | 'culture'
      member_level: 'novice' | 'member' | 'veteran' | 'elite'
      event_status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled'
    }
  }
}
