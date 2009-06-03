require 'rubygems'
require 'sinatra'

# really long require, but it's the way it seems to work
require 'lib/bumble/bumble/bumble.rb'

class CustID
  VALS = (0..9).collect{|n| "#{n}"} + (65..90).collect{|n| n.chr}
  
  def self.getID
    id = ""
    while id.length < 4
      id << VALS[(rand*VALS.size).floor]
    end
    return id
  end
end

class MySystemModel
  include Bumble
  ds :content, :key
end

mime :json, "application/json"
# set :static, true

def raw_post
  request.env["rack.input"].read
end

get '/models' do
  content_type :json
  models = MySystemModel.all
  "{ models: [\"#{models.collect{|m| m.key}.join("\",\"")}\"] }"
end

put '/models' do
  content_type :json
  random_key = CustID.getID
  model = true
  while model
    random_key = CustID.getID
    model = MySystemModel.find(:key => random_key)
  end
  myModel = MySystemModel.create(:content => raw_post, :key => random_key)
  "{ key: \"#{myModel.key}\" }"
end

get '/models/:key' do
  content_type :json
  myModel = MySystemModel.find(:key => params[:key])
  if myModel
    myModel.content
  else
    not_found
  end
end

put '/models/:key' do
  content_type :json
  myModel = MySystemModel.find(:key => params[:key])
  if myModel
    myModel.content = raw_post
    myModel.save!
    "{ key: \"#{myModel.key}\" }"
  else
    not_found
  end
end
