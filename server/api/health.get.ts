import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    const client = await serverSupabaseClient(event)
    
    // Test connection by querying a non-existent table
    // If we get a "table not found" error, the connection works
    const { error } = await client.from('_health_check').select('*').limit(1)
    
    // These error codes/messages indicate the connection works but table doesn't exist
    const isTableNotFoundError = error?.code === 'PGRST116' || 
                                  error?.code === '42P01' || 
                                  error?.message?.toLowerCase().includes('could not find')
    
    const connectionWorks = !error || isTableNotFoundError
    
    return {
      success: true,
      supabase: {
        connected: connectionWorks,
        message: connectionWorks 
          ? 'Supabase connection successful' 
          : `Connection failed: ${error?.message}`,
        errorCode: error?.code,
      },
      timestamp: new Date().toISOString(),
    }
  } catch (err) {
    return {
      success: false,
      supabase: {
        connected: false,
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      timestamp: new Date().toISOString(),
    }
  }
})
