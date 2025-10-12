// Blog post management system
class BlogManager {
    constructor() {
        this.posts = [];
        this.postsContainer = document.getElementById('blog-posts');
    }

    async loadPosts() {
        try {
            // Load post list from posts.json
            const response = await fetch('blog-posts/posts.json');
            
            if (!response.ok) {
                throw new Error(`Failed to fetch posts.json: ${response.status} ${response.statusText}`);
            }
            
            const postList = await response.json();
            
            // Load each post
            for (const postFile of postList.posts) {
                await this.loadPost(postFile);
            }
            
            this.renderPosts();
        } catch (error) {
            console.error('Error loading blog posts:', error);
            this.renderError();
        }
    }

    async loadPost(filename) {
        try {
            const response = await fetch(`blog-posts/${filename}`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch ${filename}: ${response.status} ${response.statusText}`);
            }
            
            const markdown = await response.text();
            
            const post = this.parseMarkdown(markdown);
            post.filename = filename;
            this.posts.push(post);
        } catch (error) {
            console.error(`Error loading post ${filename}:`, error);
        }
    }

    parseMarkdown(markdown) {
        const lines = markdown.split('\n');
        const post = { metadata: {}, content: '' };
        
        let inFrontMatter = false;
        let contentStart = 0;
        
        // Parse front matter
        if (lines[0] === '---') {
            inFrontMatter = true;
            for (let i = 1; i < lines.length; i++) {
                if (lines[i] === '---') {
                    contentStart = i + 1;
                    break;
                }
                
                const [key, ...valueParts] = lines[i].split(':');
                if (key && valueParts.length > 0) {
                    let value = valueParts.join(':').trim();
                    
                    // Remove quotes if present
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.slice(1, -1);
                    }
                    
                    // Parse arrays (tags)
                    if (value.startsWith('[') && value.endsWith(']')) {
                        value = value.slice(1, -1).split(',').map(item => 
                            item.trim().replace(/"/g, '')
                        );
                    }
                    
                    post.metadata[key.trim()] = value;
                }
            }
        }
        
        // Parse content (simple markdown to HTML)
        const content = lines.slice(contentStart).join('\n');
        post.content = this.markdownToHtml(content);
        
        return post;
    }

    markdownToHtml(markdown) {
        return markdown
            // Headers
            .replace(/^### (.*$)/gim, '<h4>$1</h4>')
            .replace(/^## (.*$)/gim, '<h3>$1</h3>')
            .replace(/^# (.*$)/gim, '<h2>$1</h2>')
            // Bold
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.*)\*/gim, '<em>$1</em>')
            // Code blocks
            .replace(/```[\s\S]*?```/gim, (match) => {
                const code = match.replace(/```/g, '').trim();
                return `<pre><code>${code}</code></pre>`;
            })
            // Inline code
            .replace(/`([^`]*)`/gim, '<code>$1</code>')
            // Links
            .replace(/\[([^\]]*)\]\(([^\)]*)\)/gim, '<a href="$2">$1</a>')
            // Lists
            .replace(/^\- (.*$)/gim, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
            // Paragraphs
            .replace(/\n\n/gim, '</p><p>')
            .replace(/^(?!<[h|u|p|c])(.*)$/gim, '<p>$1</p>')
            // Clean up
            .replace(/<p><\/p>/gim, '')
            .replace(/<p>(<h[1-6]>)/gim, '$1')
            .replace(/(<\/h[1-6]>)<\/p>/gim, '$1');
    }

    renderPosts() {
        if (!this.postsContainer) return;
        
        // Sort posts by date (newest first)
        this.posts.sort((a, b) => new Date(b.metadata.date) - new Date(a.metadata.date));
        
        this.postsContainer.innerHTML = this.posts.map(post => `
            <article data-post-id="${post.filename}">
                <header>
                    <h3>${post.metadata.title}</h3>
                    <div>
                        <time datetime="${post.metadata.date}">${this.formatDate(post.metadata.date)}</time>
                        ${post.metadata.readTime ? ` | ${post.metadata.readTime}` : ''}
                        ${post.metadata.tags ? ` | Tags: ${post.metadata.tags.join(', ')}` : ''}
                    </div>
                </header>
                <div>
                    ${post.content}
                </div>
                <hr>
            </article>
        `).join('');
    }

    renderError() {
        if (!this.postsContainer) return;
        
        this.postsContainer.innerHTML = `
            <div>
                <p>Sorry, there was an error loading the blog posts. Please try again later.</p>
            </div>
        `;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }
}

// Initialize blog when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const blog = new BlogManager();
    blog.loadPosts();
});