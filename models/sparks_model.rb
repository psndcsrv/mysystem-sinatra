DataMapper::Logger.new(STDOUT, :debug) # :off, :fatal, :error, :warn, :info, :debug

if Config['appspot']
  # Configure DataMapper to use the App Engine datastore 
  DataMapper.setup(:default, "appengine://auto")
  puts "loaded appengine driver"
else
  # in developer mode we use sqllite in memory only.
  #DataMapper.setup(:default, 'sqlite3::memory:')
  DataMapper.setup(:default, "sqlite3://#{Dir.pwd}/test.db")
  puts "loaded sqlite3 driver"
end

class SparksModel
  include DataMapper::Resource
  property :msuuid,       String, :key=>true
  property :content,      Text
end

unless Config['appspot']
  # this is probably only meaningful for local setup.
  #SparksModel.auto_migrate!
  SparksModel.auto_upgrade!
end
