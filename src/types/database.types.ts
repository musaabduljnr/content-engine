export interface Database {
  public: {
    Tables: {
      topics: {
        Row: {
          id: string;
          name: string;
          category: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string;
          created_at?: string;
        };
      };
      content_runs: {
        Row: {
          id: string;
          status: 'running' | 'success' | 'failed';
          error_message: string | null;
          started_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          status: 'running' | 'success' | 'failed';
          error_message?: string | null;
          started_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          status?: 'running' | 'success' | 'failed';
          error_message?: string | null;
          started_at?: string;
          completed_at?: string | null;
        };
      };
      generated_posts: {
        Row: {
          id: string;
          run_id: string;
          topic_id: string | null;
          content: string;
          hook: string;
          summary: string;
          why_it_matters: string;
          visual_direction: string | null;
          video_direction: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          topic_id?: string | null;
          content: string;
          hook: string;
          summary: string;
          why_it_matters: string;
          visual_direction?: string | null;
          video_direction?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          run_id?: string;
          topic_id?: string | null;
          content?: string;
          hook?: string;
          summary?: string;
          why_it_matters?: string;
          visual_direction?: string | null;
          video_direction?: string | null;
          created_at?: string;
        };
      };
      generated_assets: {
        Row: {
          id: string;
          run_id: string;
          type: 'image' | 'video';
          provider: 'canva' | 'hyperframes';
          asset_url: string | null;
          status: 'pending' | 'success' | 'failed';
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          type: 'image' | 'video';
          provider: 'canva' | 'hyperframes';
          asset_url?: string | null;
          status: 'pending' | 'success' | 'failed';
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          run_id?: string;
          type?: 'image' | 'video';
          provider?: 'canva' | 'hyperframes';
          asset_url?: string | null;
          status?: 'pending' | 'success' | 'failed';
          error_message?: string | null;
          created_at?: string;
        };
      };
      email_logs: {
        Row: {
          id: string;
          run_id: string;
          subject: string;
          recipient: string;
          status: 'success' | 'failed';
          error_message: string | null;
          sent_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          subject: string;
          recipient: string;
          status: 'success' | 'failed';
          error_message?: string | null;
          sent_at?: string;
        };
        Update: {
          id?: string;
          run_id?: string;
          subject?: string;
          recipient?: string;
          status?: 'success' | 'failed';
          error_message?: string | null;
          sent_at?: string;
        };
      };
      calendar_logs: {
        Row: {
          id: string;
          run_id: string;
          event_id: string | null;
          title: string;
          scheduled_for: string;
          status: 'success' | 'failed';
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          run_id: string;
          event_id?: string | null;
          title: string;
          scheduled_for: string;
          status: 'success' | 'failed';
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          run_id?: string;
          event_id?: string | null;
          title?: string;
          scheduled_for?: string;
          status?: 'success' | 'failed';
          error_message?: string | null;
          created_at?: string;
        };
      };
      settings: {
        Row: {
          key: string;
          value: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: string;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: string;
          updated_at?: string;
        };
      };
    };
  };
}
