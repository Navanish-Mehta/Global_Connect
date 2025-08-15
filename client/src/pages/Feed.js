import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getFeed, createPost, likePost, addComment, deletePost, deleteComment, sharePost } from '../redux/slices/postSlice';
import { toast } from 'react-hot-toast';

const Feed = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { feed, loading } = useSelector((state) => state.post);
  
  const [newPost, setNewPost] = useState('');
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [mediaFiles, setMediaFiles] = useState([]);

  useEffect(() => {
    if (user) {
      dispatch(getFeed(user._id));
    }
  }, [dispatch, user]);

  const handleMediaChange = (e) => {
    setMediaFiles(Array.from(e.target.files));
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.trim() && mediaFiles.length === 0) {
      toast.error('Please write something or add media to post');
      return;
    }
    try {
      let uploadedUrls = [];
      if (mediaFiles.length > 0) {
        const formData = new FormData();
        mediaFiles.forEach(file => formData.append('files', file));
        const res = await fetch('/api/posts/upload', { 
          method: 'POST', 
          body: formData,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const data = await res.json();
        uploadedUrls = data.urls || [];
      }
      
      const postData = {
        content: newPost,
        visibility: 'public',
        images: uploadedUrls.filter(url => url.match(/\.(jpg|jpeg|png|gif)$/i)),
        videos: uploadedUrls.filter(url => url.match(/\.(mp4|webm|ogg)$/i)),
      };
      await dispatch(createPost(postData)).unwrap();
      setNewPost('');
      setMediaFiles([]);
      toast.success('Post created successfully!');
    } catch (error) {
      toast.error(error.message || 'Failed to create post');
    }
  };

  const handleLike = async (postId) => {
    try {
      await dispatch(likePost(postId)).unwrap();
    } catch (error) {
      toast.error('Failed to like post');
    }
  };

  const handleComment = async (postId) => {
    if (!commentText.trim()) return;

    try {
      await dispatch(addComment({ postId, text: commentText })).unwrap();
      setCommentText('');
      setReplyingTo(null);
    } catch (error) {
      toast.error('Failed to add comment');
    }
  };

  const handleDeletePost = async (postId) => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        await dispatch(deletePost(postId)).unwrap();
        toast.success('Post deleted successfully');
      } catch (error) {
        toast.error('Failed to delete post');
      }
    }
  };

  const handleSharePost = async (postId) => {
    try {
      await dispatch(sharePost(postId)).unwrap();
      toast.success('Post shared successfully!');
    } catch (error) {
      toast.error('Failed to share post');
    }
  };

  const handleDeleteComment = async (postId, commentId) => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      try {
        await dispatch(deleteComment({ postId, commentId })).unwrap();
        toast.success('Comment deleted successfully');
      } catch (error) {
        toast.error('Failed to delete comment');
      }
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Please log in to view your feed</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Create Post */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
          <form onSubmit={handleCreatePost}>
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
                {user.profilePic ? (
                  <img src={user.profilePic} alt="Profile" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <span className="text-lg font-semibold text-white">{user.name?.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1">
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="What's on your mind? Share your thoughts..."
                  className="w-full p-4 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                  rows="3"
                />

                <div className="mt-2 flex items-center space-x-2">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleMediaChange}
                    className="hidden"
                    id="media-upload"
                  />
                  <label htmlFor="media-upload" className="cursor-pointer flex items-center space-x-2 text-gray-500 hover:text-blue-600 transition-colors duration-200">
                    <span className="text-xl">📷</span>
                    <span className="text-sm">Photo/Video</span>
                  </label>
                  {mediaFiles.length > 0 && (
                    <span className="text-xs text-gray-500">{mediaFiles.length} file(s) selected</span>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <button
                    type="submit"
                    disabled={loading || (!newPost.trim() && mediaFiles.length === 0)}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                  >
                    {loading ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Posting...</span>
                      </div>
                    ) : (
                      'Post'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Feed Posts */}
        {loading ? (
          <div className="text-center py-8">
            <div className="text-xl">Loading posts...</div>
          </div>
        ) : !feed || !Array.isArray(feed) || feed.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-xl text-gray-500">No posts yet. Start connecting with people!</div>
          </div>
        ) : (
          <div className="space-y-6">
            {feed.map((post) => (
              <div key={post._id} className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300">
                {/* Post Header */}
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
                    {post.userId?.profilePic ? (
                      <img src={post.userId.profilePic} alt="Profile" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <span className="text-lg font-semibold text-white">{post.userId?.name?.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 text-lg">{post.userId?.name}</div>
                    <div className="text-sm text-gray-500 flex items-center space-x-2">
                      <span>{new Date(post.createdAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                      <span>•</span>
                      <span className="text-blue-600">Public</span>
                    </div>
                  </div>
                  {post.userId?._id === user._id && (
                    <button
                      onClick={() => handleDeletePost(post._id)}
                      className="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-all duration-200"
                      title="Delete post"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Post Content */}
                <div className="mb-6">
                  {post.isShared && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-lg border-l-4 border-blue-500">
                      <p className="text-sm text-gray-600 font-medium">{post.content}</p>
                    </div>
                  )}
                  <p className="text-gray-900 text-lg leading-relaxed mb-4">
                    {post.isShared ? post.originalContent : post.content}
                  </p>
                  {post.images && post.images.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 rounded-xl overflow-hidden">
                      {post.images.map((image, index) => (
                        <img
                          key={index}
                          src={image}
                          alt="Post"
                          className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300"
                        />
                      ))}
                    </div>
                  )}
                  {post.videos && post.videos.length > 0 && (
                    <div className="grid grid-cols-1 gap-3 rounded-xl overflow-hidden">
                      {post.videos.map((video, index) => (
                        <video key={index} src={video} controls className="w-full h-64 object-cover" />
                      ))}
                    </div>
                  )}
                </div>

                {/* Post Actions */}
                <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                  <div className="flex items-center space-x-8">
                    <button
                      onClick={() => handleLike(post._id)}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all duration-200 ${
                        post.likes?.includes(user._id) 
                          ? 'text-red-500 bg-red-50 hover:bg-red-100' 
                          : 'text-gray-500 hover:text-red-500 hover:bg-gray-50'
                      }`}
                    >
                      <svg className={`w-5 h-5 ${post.likes?.includes(user._id) ? 'fill-current' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      <span className="font-medium">{post.likes?.length || 0}</span>
                    </button>
                    
                    <button
                      onClick={() => setReplyingTo(replyingTo === post._id ? null : post._id)}
                      className="flex items-center space-x-2 px-4 py-2 rounded-full text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <span className="font-medium">{post.comments?.length || 0}</span>
                    </button>

                    <button
                      onClick={() => handleSharePost(post._id)}
                      className="flex items-center space-x-2 px-4 py-2 rounded-full text-gray-500 hover:text-green-600 hover:bg-green-50 transition-all duration-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                      </svg>
                      <span className="font-medium">Share</span>
                    </button>
                  </div>
                </div>

                {/* Comments Section */}
                {post.comments && post.comments.length > 0 && (
                  <div className="mt-4 border-t pt-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Comments</h4>
                    <div className="space-y-3">
                      {post.comments.map((comment) => (
                        <div key={comment._id} className="flex items-start space-x-3">
                          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                            <span className="text-sm text-gray-600">
                              {comment.author?.name?.charAt(0)}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="bg-gray-100 rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <div className="font-semibold text-sm text-gray-900">
                                  {comment.userId?.name}
                                </div>
                                {((comment.userId?._id === user._id) || (post.userId?._id === user._id)) && (
                                  <button
                                    onClick={() => handleDeleteComment(post._id, comment._id)}
                                    className="text-red-500 hover:text-red-700 text-xs"
                                    title="Delete comment"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                              <div className="text-gray-700">{comment.text || comment.content}</div>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                               {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString() : ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Comment */}
                {replyingTo === post._id && (
                  <div className="mt-4 border-t pt-4">
                    <div className="flex space-x-3">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Write a comment..."
                        className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <button
                        onClick={() => handleComment(post._id)}
                        disabled={!commentText.trim()}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Comment
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Feed;
