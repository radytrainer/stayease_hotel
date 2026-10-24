/**
 * Khmer for messages the API sends in English (problem `detail`), matched exactly. Messages that carry a value
 * (a date, a code, a number) are matched by pattern in lang.ts instead.
 */
export const SERVER:Record<string,string>={
  // Generic HTTP fallbacks
  'Some details need attention. Check the form and try again.':'ព័ត៌មានមួយចំនួនត្រូវការកែតម្រូវ។ សូមពិនិត្យទម្រង់ ហើយព្យាយាមម្ដងទៀត។',
  'Please sign in to continue.':'សូមចូលគណនីដើម្បីបន្ត។',
  'You do not have access to this.':'អ្នកមិនមានសិទ្ធិចូលប្រើផ្នែកនេះទេ។',
  'We could not find what you were looking for.':'យើងរកមិនឃើញអ្វីដែលអ្នកកំពុងស្វែងរកទេ។',
  'This changed while you were working. Refresh and try again.':'ព័ត៌មាននេះបានផ្លាស់ប្ដូរខណៈពេលអ្នកកំពុងធ្វើការ។ សូមផ្ទុកទំព័រឡើងវិញ ហើយព្យាយាមម្ដងទៀត។',
  'Too many attempts. Please wait a few minutes and try again.':'ព្យាយាមច្រើនដងពេក។ សូមរង់ចាំពីរបីនាទី រួចព្យាយាមម្ដងទៀត។',
  'Something went wrong on our side. Please try again.':'មានបញ្ហាកើតឡើងនៅខាងយើង។ សូមព្យាយាមម្ដងទៀត។',
  'Something went wrong. Please try again.':'មានបញ្ហាកើតឡើង។ សូមព្យាយាមម្ដងទៀត។',
  'Too many attempts':'ព្យាយាមច្រើនដងពេក',
  'One or more request fields are invalid':'ព័ត៌មានមួយ ឬច្រើនដែលបានបញ្ចូលមិនត្រឹមត្រូវ',
  'Invalid request':'សំណើមិនត្រឹមត្រូវ',
  'The request could not be completed':'មិនអាចបញ្ចប់សំណើនេះបានទេ',
  'The request conflicts with current data or inventory':'សំណើនេះមិនស្របនឹងទិន្នន័យ ឬបន្ទប់ទំនេរបច្ចុប្បន្ន',
  'External service unavailable':'សេវាខាងក្រៅមិនអាចប្រើបានទេ',
  'The external service could not complete this request':'សេវាខាងក្រៅមិនអាចបញ្ចប់សំណើនេះបានទេ',

  // Accounts and sign-in
  'An account with this email already exists':'មានគណនីដែលប្រើអ៊ីមែលនេះរួចហើយ',
  'Email or password is incorrect':'អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ',
  'Current password is incorrect':'ពាក្យសម្ងាត់បច្ចុប្បន្នមិនត្រឹមត្រូវ',
  'Choose a password different from your current password':'សូមជ្រើសរើសពាក្យសម្ងាត់ដែលខុសពីពាក្យសម្ងាត់បច្ចុប្បន្នរបស់អ្នក',
  'User not found':'រកមិនឃើញអ្នកប្រើប្រាស់',

  // Search and booking
  'A stay cannot exceed 60 nights':'ការស្នាក់នៅមិនអាចលើសពី ៦០ យប់បានទេ',
  'Check-in cannot be in the past':'ថ្ងៃចូលស្នាក់នៅមិនអាចជាថ្ងៃកន្លងផុតទៅហើយបានទេ',
  'Check-out must be after check-in':'ថ្ងៃចាកចេញត្រូវតែនៅក្រោយថ្ងៃចូលស្នាក់នៅ',
  'Guests must be between 1 and 20':'ចំនួនភ្ញៀវត្រូវនៅចន្លោះពី ១ ដល់ ២០ នាក់',
  'Choose between 1 and 8 distinct rooms':'សូមជ្រើសរើសបន្ទប់ពី ១ ដល់ ៨ ផ្សេងៗគ្នា',
  'Provide valid dates for a stay of up to 60 nights':'សូមផ្ដល់កាលបរិច្ឆេទត្រឹមត្រូវសម្រាប់ការស្នាក់នៅមិនលើសពី ៦០ យប់',
  'Select valid dates (up to 60 nights) and between 1 and 20 guests':'សូមជ្រើសរើសកាលបរិច្ឆេទត្រឹមត្រូវ (មិនលើសពី ៦០ យប់) និងភ្ញៀវពី ១ ដល់ ២០ នាក់',
  'Sort must be name, price_asc or price_desc':'ការតម្រៀបត្រូវតែជា ឈ្មោះ ឬតម្លៃ',
  'Selected inventory is no longer available':'បន្ទប់ដែលបានជ្រើសរើសលែងទំនេរហើយ',
  'Selected room is unavailable':'បន្ទប់ដែលបានជ្រើសរើសមិនទំនេរទេ',
  'Selected rooms do not have enough guest capacity':'បន្ទប់ដែលបានជ្រើសរើសមិនមានកន្លែងគ្រប់គ្រាន់សម្រាប់ភ្ញៀវទេ',
  'Selected rooms use different currencies':'បន្ទប់ដែលបានជ្រើសរើសប្រើរូបិយប័ណ្ណខុសៗគ្នា',
  'Hotel not found':'រកមិនឃើញសណ្ឋាគារ',
  'Room not found':'រកមិនឃើញបន្ទប់',
  'Room type not found':'រកមិនឃើញប្រភេទបន្ទប់',
  'Reservation not found':'រកមិនឃើញការកក់',
  'Reservation payment hold has expired':'ការរក្សាបន្ទប់សម្រាប់ការទូទាត់បានផុតកំណត់ហើយ',
  'Your room hold has ended. Search again to book these dates.':'ការរក្សាបន្ទប់របស់អ្នកបានបញ្ចប់។ សូមស្វែងរកម្ដងទៀតដើម្បីកក់កាលបរិច្ឆេទទាំងនេះ។',
  'Notification not found':'រកមិនឃើញដំណឹង',

  // Payment and cancellation
  'Online checkout is not configured':'ការទូទាត់តាមអនឡាញមិនទាន់បានរៀបចំទេ',
  'This reservation has already been paid':'ការកក់នេះត្រូវបានបង់ប្រាក់រួចហើយ',
  'Nothing is due after your discount. Choose Pay at hotel to confirm this booking.':'បន្ទាប់ពីបញ្ចុះតម្លៃ មិនមានប្រាក់ត្រូវបង់ទេ។ សូមជ្រើសរើស «បង់នៅសណ្ឋាគារ» ដើម្បីបញ្ជាក់ការកក់នេះ។',
  'Only a held reservation can be confirmed for payment at the hotel':'មានតែការកក់ដែលកំពុងរក្សាទុកប៉ុណ្ណោះ ដែលអាចបញ្ជាក់ដើម្បីបង់នៅសណ្ឋាគារបាន',
  'No pay-at-hotel balance for this reservation':'ការកក់នេះមិនមានប្រាក់ត្រូវបង់នៅសណ្ឋាគារទេ',
  'Nothing is due at the hotel for this reservation':'ការកក់នេះមិនមានប្រាក់ត្រូវបង់នៅសណ្ឋាគារទេ',
  'Only active or completed stays can be marked as paid':'មានតែការស្នាក់នៅដែលកំពុងដំណើរការ ឬបានបញ្ចប់ប៉ុណ្ណោះ ដែលអាចសម្គាល់ថាបានបង់',
  'This reservation cannot be cancelled in its current state':'ការកក់នេះមិនអាចលុបចោលក្នុងស្ថានភាពបច្ចុប្បន្នបានទេ',
  'Successful payment record is required to cancel this confirmed reservation':'ត្រូវការកំណត់ត្រាការទូទាត់ដែលជោគជ័យ ដើម្បីលុបចោលការកក់ដែលបានបញ្ជាក់នេះ',
  'You paid for this stay at the hotel, so please contact the hotel to cancel and arrange your refund':'អ្នកបានបង់ប្រាក់សម្រាប់ការស្នាក់នៅនេះនៅសណ្ឋាគារ ដូច្នេះសូមទាក់ទងសណ្ឋាគារដើម្បីលុបចោល និងរៀបចំការសងប្រាក់វិញ',
  'Invalid payment event':'ព្រឹត្តិការណ៍ទូទាត់មិនត្រឹមត្រូវ',
  'Invalid payment signature':'ហត្ថលេខាទូទាត់មិនត្រឹមត្រូវ',
  'Verified payment authorization is required':'ត្រូវការការអនុញ្ញាតទូទាត់ដែលបានផ្ទៀងផ្ទាត់',

  // Reception
  'Reservation is not eligible for check-in':'ការកក់នេះមិនអាចចូលស្នាក់នៅបានទេ',
  'Reservation is not eligible for check-out':'ការកក់នេះមិនអាចចាកចេញបានទេ',
  'Check-in is outside the reservation stay dates':'ថ្ងៃចូលស្នាក់នៅមិនស្ថិតក្នុងកាលបរិច្ឆេទស្នាក់នៅនៃការកក់ទេ',
  'Check-out cannot be recorded before the reservation check-out date':'មិនអាចកត់ត្រាការចាកចេញមុនថ្ងៃចាកចេញនៃការកក់បានទេ',
  'You are not assigned to reception at this hotel':'អ្នកមិនត្រូវបានចាត់តាំងឱ្យទទួលភ្ញៀវនៅសណ្ឋាគារនេះទេ',

  // Hotel management
  'You are not assigned to manage this hotel':'អ្នកមិនត្រូវបានចាត់តាំងឱ្យគ្រប់គ្រងសណ្ឋាគារនេះទេ',
  'StayEase currently lists hotels in Cambodia only':'បច្ចុប្បន្ន StayEase ដាក់បញ្ជីតែសណ្ឋាគារនៅប្រទេសកម្ពុជាប៉ុណ្ណោះ',
  'Hotels in Cambodia use the Asia/Phnom_Penh time zone':'សណ្ឋាគារនៅកម្ពុជាប្រើម៉ោងភ្នំពេញ (Asia/Phnom_Penh)',
  'The map location must be inside Cambodia':'ទីតាំងលើផែនទីត្រូវតែនៅក្នុងប្រទេសកម្ពុជា',
  'Provide both latitude and longitude, or neither':'សូមផ្ដល់ទាំងរយៈទទឹង និងរយៈបណ្ដោយ ឬមិនផ្ដល់ទាំងពីរ',
  'Pricing end date must be after its start date':'ថ្ងៃបញ្ចប់តម្លៃត្រូវតែនៅក្រោយថ្ងៃចាប់ផ្ដើម',
  'Pricing currency configuration is inconsistent':'ការកំណត់រូបិយប័ណ្ណនៃតម្លៃមិនស៊ីសង្វាក់គ្នា',
  'Pricing rule currency must match the room type':'រូបិយប័ណ្ណនៃតម្លៃត្រូវតែដូចគ្នានឹងប្រភេទបន្ទប់',
  'Invalid cancellation policy':'គោលការណ៍លុបចោលមិនត្រឹមត្រូវ',
  'Unknown room status':'ស្ថានភាពបន្ទប់មិនស្គាល់',
  'Unknown hotel status':'ស្ថានភាពសណ្ឋាគារមិនស្គាល់',
  'Select a report period of up to 366 days':'សូមជ្រើសរើសរយៈពេលរបាយការណ៍មិនលើសពី ៣៦៦ ថ្ងៃ',
  'Staff role must be RECEPTIONIST or HOTEL_MANAGER':'តួនាទីបុគ្គលិកត្រូវតែជាបុគ្គលិកទទួលភ្ញៀវ ឬអ្នកគ្រប់គ្រងសណ្ឋាគារ',

  // Photos
  'Choose an image smaller than 10 MB':'សូមជ្រើសរើសរូបភាពដែលតូចជាង 10 MB',
  'Could not read the uploaded image':'មិនអាចអានរូបភាពដែលបានផ្ទុកឡើងបានទេ',
  'Upload a valid PNG, JPEG, or WebP image':'សូមផ្ទុកឡើងរូបភាព PNG, JPEG ឬ WebP ដែលត្រឹមត្រូវ',
  'Image description must be 250 characters or fewer':'ការពិពណ៌នារូបភាពត្រូវមានមិនលើសពី ២៥០ តួអក្សរ',
  'Photo category must be ROOM, BATHROOM, VIEW or EXTERIOR':'ប្រភេទរូបថតត្រូវតែជា បន្ទប់ បន្ទប់ទឹក ទេសភាព ឬខាងក្រៅ',
  'Hotel image not found':'រកមិនឃើញរូបភាពសណ្ឋាគារ',
  'Room image not found':'រកមិនឃើញរូបភាពបន្ទប់',
  'Hotel image storage is not configured':'កន្លែងរក្សាទុករូបភាពមិនទាន់បានរៀបចំទេ',

  // Promotions
  'Promotion code not found':'រកមិនឃើញកូដបញ្ចុះតម្លៃ',
  'This code has been fully used':'កូដនេះត្រូវបានប្រើអស់ហើយ',
  'This code isn’t valid at this hotel':'កូដនេះមិនអាចប្រើនៅសណ្ឋាគារនេះបានទេ',
  'You’ve already used this code':'អ្នកបានប្រើកូដនេះរួចហើយ',
  'Use 3 to 32 letters, digits, - or _ for the code':'កូដត្រូវមានពី ៣ ដល់ ៣២ តួ ដោយប្រើអក្សរ លេខ - ឬ _',
  'A percentage discount can be at most 100%':'ការបញ្ចុះតម្លៃជាភាគរយមិនអាចលើសពី 100% បានទេ',
  'The end date must be on or after the start date':'ថ្ងៃបញ្ចប់ត្រូវតែជាថ្ងៃចាប់ផ្ដើម ឬក្រោយនោះ',
  'Only platform promotions can be featured on the home page':'មានតែប្រូម៉ូសិនទូទាំងប្រព័ន្ធប៉ុណ្ណោះ ដែលអាចផ្សព្វផ្សាយនៅលើទំព័រដើមបាន',
};
