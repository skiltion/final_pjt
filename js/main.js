const generateRecipeBtn = document.getElementById("generate-recipe-btn");
if (generateRecipeBtn) {
    generateRecipeBtn.addEventListener("click", generateRecipe);
}

const recipeForm = document.getElementById("recipe-form");
if (recipeForm) {
    recipeForm.addEventListener("submit", (event) => {
        event.preventDefault();
    });
}

const token = localStorage.getItem("token");

if (token) {
    fetch("http://localhost:3000/user-info", {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
    })
    .then(response => {
        if (!response.ok) throw new Error("사용자 정보를 가져올 수 없습니다.");
        return response.json();
    })
    .then(data => {
        localStorage.setItem("userId", data.id);
        localStorage.setItem("email", data.email);
        localStorage.setItem("createdAt", data.created_at);
        console.log("현재 로그인한 유저 ID:", data.id);
    })
    .catch(error => console.error("사용자 정보 불러오기 실패:", error));
}

const loginBtn = document.querySelector(".login-btn");
const registerBtn = document.querySelector(".register-btn");
const userInfoBtn = document.querySelector(".user-info-btn");
const logoutBtn = document.querySelector(".logout-btn");
const recipeHistoryBtn = document.querySelector(".recipe-history-btn")

if (token) {
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

loadPosts();

const postForm = document.getElementById("post-form");
if (postForm) {
    postForm.addEventListener("submit", createPost);
}

async function generateRecipe(event) {

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
    if (generateRecipeBtn) {
        generateRecipeBtn.disabled = true; // 중복 요청 방지
    }


    try {
        const response = await fetch("http://localhost:3000/generate-recipe", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({ tastePreference, dishName })
        });

        console.log("서버 응답 상태:", response.status);

        if (!response.ok) throw new Error("레시피 생성 실패");

        const data = await response.json();
        console.log("서버 응답 데이터:", data);

        recipeOutput.innerHTML = `<h3>${dishName} 레시피</h3><p>${data.recipe}</p>`;

        event.preventDefault();
    } catch (error) {
        console.error("레시피 생성 실패:", error);
    } finally {
        if (generateRecipeBtn) {
            generateRecipeBtn.disabled = false; // 버튼 다시 활성화
        };
    };
};

async function loadPosts() {
    try {
        const response = await fetch("http://localhost:3000/posts");
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

async function createPost(event) {
    event.preventDefault();
    
    const titleInput = document.getElementById("post-title");
    const contentInput = document.getElementById("post-content");

    // 요소가 존재하는지 확인
    if (!titleInput || !contentInput) {
        console.error("게시물 입력 필드를 찾을 수 없습니다.");
        return;
    }

    const title = titleInput.value.trim();
    const content = contentInput.value.trim();
    
    if (!title || !content) {
        alert("제목과 내용을 입력하세요.");
        return;
    }
    
    try {
        const response = await fetch("http://localhost:3000/posts", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
            body: JSON.stringify({ title, content })
        });
        
        if (!response.ok) throw new Error("게시물 작성 실패");
        
        alert("게시물이 작성되었습니다!");
        document.getElementById("post-form").reset();
        loadPosts();
    } catch (error) {
        console.error("게시물 작성 실패:", error);
    }
}
async function editPost(postId, oldTitle, oldContent) {
    const newTitle = prompt("새로운 제목을 입력하세요:", oldTitle);
    if (!newTitle) return;

    const newContent = prompt("새로운 내용을 입력하세요:", oldContent);
    if (!newContent) return;

    fetch(`http://localhost:3000/posts/${postId}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ title: newTitle, content: newContent }),
    })
    .then((res) => res.json())
    .then((data) => {
        alert(data.message);
        loadPosts();
    })
    .catch((error) => console.error("Error updating post:", error));
}

async function deletePost(postId) {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    fetch(`http://localhost:3000/posts/${postId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
    })
    .then((res) => res.json())
    .then((data) => {
        alert(data.message);
        loadPosts();
    })
    .catch((error) => console.error("Error deleting post:", error));
}

