require 'config'
require 'sinatra'

# SET MIME_TYPES HERE:
mime :json, "application/json"

get '/' do
  redirect '/mysystem.html'
end

get '/sparks' do
  redirect '/sparks/activities/resistor-colors/index.html'
end

get '/mysystem-demo.html' do
  redirect '/mysystem.html'
end

get '/sparks_models' do
  content_type :json
  models = SparksModel.all
  "{ sparks_models: [\"#{models.collect{|m| m.key}.join("\",\"")}\"] }"
end

put '/sparks_models' do
  content_type :json
  random_key = CustID.getID
  model = true
  while model
    random_key = CustID.getID
    model = SparksModel.get(random_key)
  end
  myModel = SparksModel.create(:content => raw_post, :msuuid => random_key)
  "{ key: \"#{myModel.key}\" }"
end

get '/sparks_models/:key' do
  content_type :json
  myModel = SparksModel.get(params[:key])
  if myModel
    myModel.content
  else
    not_found do
      "{}"
    end
  end
end

put '/sparks_models/:key' do
  content_type :json
  myModel = SparksModel.get(params[:key])
  unless myModel
    myModel = SparksModel.new(:msuuid => params[:key])
  end
  myModel.content = raw_post || "{}"
  myModel.save
  "{ key: \"#{myModel.key}\" }"
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
    model = MySystemModel.get(random_key)
  end
  myModel = MySystemModel.create(:content => raw_post, :msuuid => random_key)
  "{ key: \"#{myModel.key}\" }"
end

get '/info' do
  @env = ENV
  erb :info
end

get '/models/:key' do
  content_type :json
  myModel = MySystemModel.get(params[:key])
  if myModel
    myModel.content
  else
    not_found do
      "{}"
    end
  end
end

put '/models/:key' do
  content_type :json
  myModel = MySystemModel.get(params[:key])
  unless myModel
    myModel = MySystemModel.new(:msuuid => params[:key])
  end
  myModel.content = raw_post || "{}"
  myModel.save
  "{ key: \"#{myModel.key}\" }"
end
