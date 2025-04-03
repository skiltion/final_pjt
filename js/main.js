document.addEventListener("DOMContentLoaded", () => {
    const generateRecipeBtn = document.getElementById("generate-recipe-btn");
    if (generateRecipeBtn) {
        generateRecipeBtn.addEventListener("click", generateRecipe);
    }
    checkUserStatus();
    loadPosts();
});

// ✅ fetchWithAuth: API 요청을 감싸는 함수 (토큰 만료 시 자동 로그아웃)
async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem("token");

    if (!token) {
        logoutUser();
        return;
    }

    const headers = { ...options.headers, Authorization: `Bearer ${token}` };
    
    try {
        const response = await fetch(url, { ...options, headers });

        if (response.status === 401) {
            const data = await response.json();
            if (data.error === "Token expired. Please log in again.") {
                alert("세션이 만료되었습니다. 다시 로그인해주세요.");
            }
        }

        return response;
    } catch (error) {
        console.error("API 요청 실패:", error);
    }
}

// ✅ 로그아웃 함수
function logoutUser() {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("email");
    localStorage.removeItem("createdAt");
}

// ✅ 로그인 상태 확인
function checkUserStatus() {
    const token = localStorage.getItem("token");

    const loginBtn = document.querySelector(".login-btn");
    const registerBtn = document.querySelector(".register-btn");
    const userInfoBtn = document.querySelector(".user-info-btn");
    const logoutBtn = document.querySelector(".logout-btn");
    const recipeHistoryBtn = document.querySelector(".recipe-history-btn");

    if (token) {
        fetchWithAuth("http://localhost:3000/user-info", { method: "GET" })
            .then(response => response.json())
            .then(data => {
                localStorage.setItem("userId", data.id);
                localStorage.setItem("email", data.email);
                localStorage.setItem("createdAt", data.created_at);
                console.log("현재 로그인한 유저 ID:", data.id);
            })
            .catch(error => console.error("사용자 정보 불러오기 실패:", error));

        loginBtn.style.display = "none";
        registerBtn.style.display = "none";
        userInfoBtn.style.display = "block";
        logoutBtn.style.display = "block";
        recipeHistoryBtn.style.display = "block";
    } else {
        loginBtn.style.display = "block";
        registerBtn.style.display = "block";
        userInfoBtn.style.display = "none";
        logoutBtn.style.display = "none";
        recipeHistoryBtn.style.display = "none";
    }
}

// ✅ 레시피 생성 요청
async function generateRecipe(event) {
    event.preventDefault();

    const tasteInput = document.getElementById("taste-preference");
    const dishInput = document.getElementById("dish-name");
    const recipeOutput = document.getElementById("recipe-output");

    if (!tasteInput || !dishInput || !recipeOutput) {
        console.error("레시피 입력 필드 또는 출력 영역을 찾을 수 없습니다.");
        return;
    }

    const tastePreference = tasteInput.value.trim();
    const dishName = dishInput.value.trim();

    if (!tastePreference || !dishName) {
        alert("입맛과 요리명을 입력하세요.");
        return;
    }

    const generateRecipeBtn = document.getElementById("generate-recipe-btn");
    if (generateRecipeBtn) generateRecipeBtn.disabled = true;

    try {
        const response = await fetchWithAuth("http://localhost:3000/generate-recipe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tastePreference, dishName }),
        });

        if (!response.ok) throw new Error("레시피 생성 실패");

        const data = await response.json();
        recipeOutput.innerHTML = `<h3>${dishName} 레시피</h3><p>${data.recipe}</p>`;

    } catch (error) {
        console.error("레시피 생성 실패:", error);
    } finally {
        if (generateRecipeBtn) generateRecipeBtn.disabled = false;
    }
}

async function loadPosts() {
    try {
        const response = await fetchWithAuth("http://localhost:3000/posts");

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        
        const data = await response.json();
        console.log("서버 응답 데이터:", data);

        if (!data.posts || !Array.isArray(data.posts)) {
            console.error("Expected an array but got:", data);
            return;
        }

        const postList = document.getElementById("post-list");
        postList.innerHTML = "";

        const userId = localStorage.getItem("userId");
        console.log("현재 로그인한 유저 ID:", userId);

        data.posts.forEach((post) => {
            const postDiv = document.createElement("div");
            postDiv.classList.add("post-item");
            postDiv.innerHTML = `
                <h3>${post.title}</h3>
                <p>${post.content}</p>
                <p><strong>작성자:</strong> ${post.user_id}</p>
            `;

            // 댓글 버튼 추가 (오른쪽 아래)
            const commentButton = document.createElement("button");
            commentButton.innerText = "💬 댓글";
            commentButton.classList.add("comment-toggle");
            commentButton.onclick = () => toggleComments(post.id);

            // 댓글 섹션 추가 (초기에는 숨김)
            const commentSection = document.createElement("div");
            commentSection.classList.add("comments-section");
            commentSection.id = `comments-${post.id}`;
            commentSection.style.display = "none";
            commentSection.innerHTML = `
                <div class="comments-list"></div>
                <textarea id="comment-input-${post.id}" placeholder="댓글을 입력하세요..."></textarea>
                <button onclick="addComment(${post.id})">댓글 작성</button>
            `;

            postDiv.appendChild(commentButton);
            postDiv.appendChild(commentSection);

            if (userId && userId === String(post.user_id)) {
                const actionsDiv = document.createElement("div");
                actionsDiv.classList.add("post-actions");

                const editButton = document.createElement("button");
                editButton.innerText = "수정";
                editButton.classList.add("edit-btn");
                editButton.onclick = () => editPost(post.id, post.title, post.content);

                const deleteButton = document.createElement("button");
                deleteButton.innerText = "삭제";
                deleteButton.classList.add("delete-btn");
                deleteButton.onclick = () => deletePost(post.id);

                actionsDiv.appendChild(editButton);
                actionsDiv.appendChild(deleteButton);
                postDiv.appendChild(actionsDiv);
            }

            postList.appendChild(postDiv);
        });
    } catch (error) {
        console.error("게시글 불러오기 실패:", error);
    }
}

// 댓글 영역 보이기/숨기기
function toggleComments(postId) {
    const commentSection = document.getElementById(`comments-${postId}`);
    if (commentSection.style.display === "none") {
        commentSection.style.display = "block";
        fetchComments(postId);
    } else {
        commentSection.style.display = "none";
    }
}

function fetchComments(postId) {
    fetch(`http://localhost:3000/posts/${postId}/comments`)
        .then((res) => res.json())
        .then((data) => {
            const commentsContainer = document.getElementById(`comments-${postId}`).querySelector(".comments-list");
            commentsContainer.innerHTML = "";

            data.comments.forEach((comment) => {
                const commentElement = document.createElement("div");
                commentElement.classList.add("comment");
                commentElement.innerHTML = `
                    ${localStorage.getItem("email") === comment.author 
                    ? `<button class="comment-delete" onclick="deleteComment(${comment.id})">삭제</button>` 
                    : ""}
                    <p>${comment.content} <small>(${comment.author}, ${comment.created_at})</small></p>
                `;
                commentsContainer.appendChild(commentElement);
            });
        })
        .catch((err) => console.error("❌ 댓글 불러오기 실패:", err));
}

function addComment(postId) {
    const commentInput = document.getElementById(`comment-input-${postId}`);
    const content = commentInput.value.trim();

    if (!content) {
        alert("댓글 내용을 입력해주세요.");
        return;
    }

    fetchWithAuth(`http://localhost:3000/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
    })
    .then((res) => res.json())
    .then(() => {
        commentInput.value = "";
        fetchComments(postId);
    })
    .catch((err) => console.error("❌ 댓글 작성 실패:", err));
}

function deleteComment(commentId) {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    fetchWithAuth(`http://localhost:3000/comments/${commentId}`, {
        method: "DELETE",
    })
    .then((res) => res.json())
    .then(() => {
        alert("댓글이 삭제되었습니다.");
        fetchComments(postId);
    })
    .catch((err) => console.error("❌ 댓글 삭제 실패:", err));
}

// ✅ 게시물 작성
async function createPost(event) {
    event.preventDefault();

    const title = document.getElementById("post-title").value.trim();
    const content = document.getElementById("post-content").value.trim();

    if (!title || !content) {
        alert("제목과 내용을 입력하세요.");
        return;
    }

    try {
        const response = await fetchWithAuth("http://localhost:3000/posts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, content }),
        });

        if (!response.ok) throw new Error("게시물 작성 실패");

        alert("게시물이 작성되었습니다!");
        document.getElementById("post-form").reset();
        loadPosts();
    } catch (error) {
        console.error("게시물 작성 실패:", error);
    }
}

// ✅ 게시물 수정
async function editPost(postId, oldTitle, oldContent) {
    const newTitle = prompt("새로운 제목을 입력하세요:", oldTitle);
    if (!newTitle) return;

    const newContent = prompt("새로운 내용을 입력하세요:", oldContent);
    if (!newContent) return;

    await fetchWithAuth(`http://localhost:3000/posts/${postId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, content: newContent }),
    });

    alert("게시물이 수정되었습니다!");
    loadPosts();
}

// ✅ 게시물 삭제
async function deletePost(postId) {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    await fetchWithAuth(`http://localhost:3000/posts/${postId}`, { method: "DELETE" });

    alert("게시물이 삭제되었습니다!");
    loadPosts();
}