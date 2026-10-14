Pod::Spec.new do |s|
  s.name           = 'TenuePhoto'
  s.version        = '0.1.0'
  s.summary        = 'Subject cutout, dominant color and labels for Tenue photos'
  s.description    = 'Local Expo module that cuts out the subject of a photo, picks its dominant color and returns image labels.'
  s.author         = ''
  s.homepage       = 'https://github.com/911RS/matin'
  s.platforms      = {
    :ios => '17.0'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision', 'CoreImage'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
