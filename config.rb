require 'rubygems'
require 'dm-core'
require 'lib/util'

Config = {}
Config['appspot'] = RUBY_PLATFORM=='java'

#require 'models/my_system_model'
require 'models/sparks_model'