require 'sequel'
if RUBY_PLATFORM =~ /java/
  DB = Sequel.connect('jdbc:sqlite::memory:')
else
  DB = Sequel.sqlite
end

DB.create_table :models do
  primary_key :id
  String :key, :unique => true, :null => false
  String :content

  index :key
end
  
class MySystemModel < Sequel::Model(:models)
  def save!
    save
  end
end