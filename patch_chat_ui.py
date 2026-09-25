import re
filepath = r"src\routes\admin\components\ChatLogsPage.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# Add timeFilter state
content = content.replace("const [filterType, setFilterType] = useState<string>('all');", "const [filterType, setFilterType] = useState<string>('all');\n  const [timeFilter, setTimeFilter] = useState<string>('all');")

# Modify query to use timeFilter
old_query = """        let query = supabase
          .from('chat_sessions')
          .select('*')
          .order('last_activity_at', { ascending: false });"""
new_query = """        let query = supabase
          .from('chat_sessions')
          .select('*')
          .order('last_activity_at', { ascending: false });
          
        if (timeFilter === 'all') query = query.limit(100);
        else if (timeFilter === 'today') {
          const start = new Date(); start.setHours(0,0,0,0);
          query = query.gte('last_activity_at', start.toISOString());
        }
        else if (timeFilter === 'this_month') {
          const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
          query = query.gte('last_activity_at', start.toISOString());
        }"""
content = content.replace(old_query, new_query)

# Add Select dropdown to UI
old_ui = """        <button 
          onClick={fetchSessions}
          disabled={loading}"""
new_ui = """        <div className="flex items-center gap-4">
          <select 
            value={timeFilter} 
            onChange={(e) => { setTimeFilter(e.target.value); fetchSessions(); }}
            className="border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 pl-3 pr-10 border"
          >
            <option value="all">All Time (Recent 100)</option>
            <option value="today">Today</option>
            <option value="this_month">This Month</option>
          </select>
          <button 
            onClick={fetchSessions}
            disabled={loading}"""
content = content.replace(old_ui, new_ui)

# Add closing div to UI
content = content.replace("          Refresh\n        </button>\n      </div>", "          Refresh\n          </button>\n        </div>\n      </div>")

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)
print("Patched ChatLogsPage")
