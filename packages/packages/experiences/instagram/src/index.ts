import packageJSON from '../package.json'
import { Experience, LoaderOptions, ViewerOptions } from '@/index'
// import icon from '@/icons/instagram.png'
// import viewBlocks from './blocks'
import databaseConfig from './database'
// import messages from './messages.json'
// import dataSample from '@/data-samples/instagramV3.zip'
import preprocessor from './preprocessor'
import viewerOptions from './instagram-viewer.json'
import viewerFunctions from './viewer-functions'

const loaderOptions: LoaderOptions = {
  viewerVersion: 1,
  databaseConfig,
  files: {
    messages: '**/messages/inbox/**/message_*.json',
    followers: '**/followers_1.json',
    followings: '**/following.json',
    postsViewed: '**/posts_viewed.json',
    videosWatched: '**/videos_watched.json',
    adsViewed: '**/ads_viewed.json',
    likedComments: '**/liked_comments.json',
    likedPosts: '**/liked_posts.json',
    advertisers: '**/advertisers_using_your_activity_or_information.json',
    adsInterests: '**/other_categories_used_to_reach_you.json',
    personalInfos: '**/personal_information.json',
    threadsViewed: '**/threads_viewed.json',
    comments: '**/post_comments_*.json',
    reelsComments: '**/reels_comments.json',
    storiesViewed: '**/stories_viewed.json',
    reposts: '**/media/reposts.json',
    storyLikes: '**/story_likes.json',
    polls: '**/story_interactions/polls.json',
    storyReactions: '**/story_reaction_sticker_reactions.json',
    saved: '**/saved_posts.json',
    locationsOfInterest: '**/locations_of_interest.json',
    profileBasedIn: '**/profile_based_in.json',
    loginActivity: '**/login_activity.json'
  },
  preprocessors: {
    '**/*.json': preprocessor
  }
}

// const oldViewerOptions: ViewerOptions = {
//   title: 'Instagram',
//   dataPortal: 'https://help.instagram.com/181231772500920',
//   dataPortalMessage:
//     '<strong>Important:</strong> To make the experience work, please request your data in <strong>JSON</strong> format.',
//   dataSamples: [dataSample],
//   // icon,
//   icon: 'https://raw.githubusercontent.com/digipower-academy/digipower-experiences/a29ee41dca8d2d8aaf2e377e6422e820f66db1bd/packages/lib/icons/instagram.png',
//   hideFileExplorer: false,
//   viewBlocks,
//   messages
// }
// const oldOptions = { ...loaderOptions, ...oldViewerOptions } as ExperienceOptions

export default new Experience(
  loaderOptions,
  viewerOptions as ViewerOptions,
  packageJSON,
  import.meta.url,
  viewerFunctions
)
