const { createClient } = require("@supabase/supabase-js");

const supabase = createClient('https://lopmvrgewbpepxigktqi.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxvcG12cmdld2JwZXB4aWdrdHFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3MzQ5NTcsImV4cCI6MjA3NTMxMDk1N30._oYzAGkHJZXvg2cXR0ocTtyG3qy-n5IzVdPizEUKBVE');

module.exports = supabase;