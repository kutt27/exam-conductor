import asyncio
from sqlalchemy.future import select
from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.models.exam import Exam
from app.models.question import Question, QuestionType

async def create_comprehensive_paper():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.email == "teacher@exam.com"))
        teacher = res.scalar_one_or_none()
        if not teacher:
            print("Teacher teacher@exam.com not found!")
            return

        exam = Exam(
            teacher_id=teacher.id,
            title="Software Engineering & Systems Architecture Comprehensive Assessment",
            description="Comprehensive evaluation covering Core Algorithms, System Design, Database Internals, and Code Implementation. Features automated AI rubric evaluation, anti-cheat lockdown, and per-student randomized questions.",
            duration_minutes=90,
            access_code="TECH-2026",
            timer_mode="LOCAL",
            is_active=True
        )
        db.add(exam)
        await db.flush()

        questions_data = [
            # === 10 MCQs (2 marks each = 20 marks) ===
            {
                "type": QuestionType.MCQ,
                "order_index": 1,
                "prompt": "What is the worst-case time complexity of searching for an element in an unsorted Singly Linked List of length N?",
                "max_marks": 2.0,
                "mcq_options": ["A) O(1)", "B) O(log N)", "C) O(N)", "D) O(N log N)"],
                "mcq_correct_key": "C",
                "rubric_notes": "Award full marks for C (Linear traversal required)."
            },
            {
                "type": QuestionType.MCQ,
                "order_index": 2,
                "prompt": "Which of the following sorting algorithms offers guaranteed O(N log N) worst-case time complexity without worst-case quadratic degradation?",
                "max_marks": 2.0,
                "mcq_options": ["A) Standard QuickSort", "B) MergeSort", "C) InsertionSort", "D) BubbleSort"],
                "mcq_correct_key": "B",
                "rubric_notes": "Award full marks for B (MergeSort divides and merges in O(N log N) consistently)."
            },
            {
                "type": QuestionType.MCQ,
                "order_index": 3,
                "prompt": "In relational database transactions, what does the \"I\" in ACID stand for?",
                "max_marks": 2.0,
                "mcq_options": ["A) Integrity", "B) Isolation", "C) Idempotency", "D) Immutability"],
                "mcq_correct_key": "B",
                "rubric_notes": "Award full marks for B (Isolation)."
            },
            {
                "type": QuestionType.MCQ,
                "order_index": 4,
                "prompt": "Which HTTP request methods are strictly defined as idempotent according to the RFC 7231 specification?",
                "max_marks": 2.0,
                "mcq_options": ["A) POST and PATCH", "B) GET, PUT, and DELETE", "C) POST only", "D) CONNECT and TRACE only"],
                "mcq_correct_key": "B",
                "rubric_notes": "Award full marks for B (GET, PUT, DELETE are idempotent)."
            },
            {
                "type": QuestionType.MCQ,
                "order_index": 5,
                "prompt": "In distributed systems and the CAP theorem, what does the \"P\" represent?",
                "max_marks": 2.0,
                "mcq_options": ["A) Performance", "B) Persistence", "C) Partition Tolerance", "D) Parallelism"],
                "mcq_correct_key": "C",
                "rubric_notes": "Award full marks for C (Partition Tolerance)."
            },
            {
                "type": QuestionType.MCQ,
                "order_index": 6,
                "prompt": "What is the primary synchronization primitive used to guarantee mutual exclusion across concurrent threads accessing a shared resource?",
                "max_marks": 2.0,
                "mcq_options": ["A) Mutex / Lock", "B) Memory Barrier only", "C) Thread Pool", "D) Coroutine"],
                "mcq_correct_key": "A",
                "rubric_notes": "Award full marks for A (Mutex)."
            },
            {
                "type": QuestionType.MCQ,
                "order_index": 7,
                "prompt": "Which protocol performs a 3-way handshake (SYN, SYN-ACK, ACK) before establishing data transmission?",
                "max_marks": 2.0,
                "mcq_options": ["A) UDP", "B) TCP", "C) ICMP", "D) DNS"],
                "mcq_correct_key": "B",
                "rubric_notes": "Award full marks for B (TCP)."
            },
            {
                "type": QuestionType.MCQ,
                "order_index": 8,
                "prompt": "In Python, what is the key difference between a shallow copy and a deep copy of a nested list?",
                "max_marks": 2.0,
                "mcq_options": [
                    "A) Shallow copy duplicates nested objects; deep copy copies only outer references",
                    "B) Shallow copy copies references to nested objects; deep copy recursively duplicates nested objects",
                    "C) Deep copy works only on primitive strings and integers",
                    "D) There is no difference in memory allocation"
                ],
                "mcq_correct_key": "B",
                "rubric_notes": "Award full marks for B."
            },
            {
                "type": QuestionType.MCQ,
                "order_index": 9,
                "prompt": "Which of the following is the most robust defense against SQL Injection vulnerabilities?",
                "max_marks": 2.0,
                "mcq_options": [
                    "A) Client-side string escaping",
                    "B) Parameterized Queries / Prepared Statements with ORM query binding",
                    "C) Restricting database access to GET requests",
                    "D) Regular expression sanitization on frontend"
                ],
                "mcq_correct_key": "B",
                "rubric_notes": "Award full marks for B."
            },
            {
                "type": QuestionType.MCQ,
                "order_index": 10,
                "prompt": "Which data structure is optimal for implementing function call stacks and depth-first search (DFS)?",
                "max_marks": 2.0,
                "mcq_options": ["A) LIFO Stack", "B) FIFO Queue", "C) Circular Buffer", "D) B-Tree"],
                "mcq_correct_key": "A",
                "rubric_notes": "Award full marks for A (Stack)."
            },

            # === 5 Coding Questions (10 marks each = 50 marks) ===
            {
                "type": QuestionType.CODE_DOC,
                "order_index": 11,
                "prompt": """### Coding Challenge 1: Two Sum Target Pair
Write a function `two_sum(nums: list[int], target: int) -> list[int]` that returns the 0-indexed indices of the two numbers such that they add up to `target`.

**Requirements:**
- Strive for O(N) time complexity.
- You may assume that each input has exactly one valid solution, and you may not use the same element twice.
- Explain your time and space complexity.""",
                "max_marks": 10.0,
                "rubric_notes": "Award 6 marks for single-pass hash map (dict) O(N) algorithm storing complement. Award 2 marks for handling negative numbers and non-consecutive indices. Award 2 marks for explicit time O(N) and space O(N) complexity discussion."
            },
            {
                "type": QuestionType.CODE_DOC,
                "order_index": 12,
                "prompt": """### Coding Challenge 2: Valid Palindrome Alphanumeric Filter
Write a function `is_palindrome(s: str) -> bool` that determines if a string is a palindrome after converting all uppercase letters to lowercase and removing all non-alphanumeric characters.

**Example:**
- Input: `\"A man, a plan, a canal: Panama\"` -> Output: `True`
- Input: `\"race a car\"` -> Output: `False`

Explain your approach and memory efficiency.""",
                "max_marks": 10.0,
                "rubric_notes": "Award 6 marks for two-pointer approach or filtered comparison. Award 2 marks for edge cases (empty string, punctuation only). Award 2 marks for O(N) time and O(1) extra space analysis."
            },
            {
                "type": QuestionType.CODE_DOC,
                "order_index": 13,
                "prompt": """### Coding Challenge 3: Merge Two Sorted Lists
Write a function `merge_sorted_arrays(list1: list[int], list2: list[int]) -> list[int]` that merges two sorted lists of integers into a single sorted list in O(N + M) linear time without using built-in `sort()` or `sorted()`.

**Requirements:**
- Two-pointer comparison traversal.
- Handle lists of unequal lengths and empty lists.""",
                "max_marks": 10.0,
                "rubric_notes": "Award 6 marks for dual-pointer linear comparison and append logic. Award 2 marks for handling remaining elements after one pointer exhausts or when one list is empty. Award 2 marks for clear O(N+M) time explanation."
            },
            {
                "type": QuestionType.CODE_DOC,
                "order_index": 14,
                "prompt": """### Coding Challenge 4: Search in Rotated Sorted Array
Given a sorted integer array `nums` that has been rotated at an unknown pivot, write a function `search_rotated(nums: list[int], target: int) -> int` that returns the index of `target`, or `-1` if it is not present.

**Requirements:**
- Your algorithm must achieve O(log N) runtime complexity.
- Outline your modified binary search logic.""",
                "max_marks": 10.0,
                "rubric_notes": "Award 6 marks for modified binary search determining which half (left vs right) is strictly sorted. Award 2 marks for mid/low/high pointer updates and returning -1 when missing. Award 2 marks for O(log N) verification."
            },
            {
                "type": QuestionType.CODE_DOC,
                "order_index": 15,
                "prompt": """### Coding Challenge 5: Group Anagrams
Given an array of strings `strs`, write a function `group_anagrams(strs: list[str]) -> list[list[str]]` that groups all anagrams together in any order.

**Example:**
`strs = [\"eat\",\"tea\",\"tan\",\"ate\",\"nat\",\"bat\"]`
Output: `[[\"bat\"],[\"nat\",\"tan\"],[\"ate\",\"eat\",\"tea\"]]`

Explain your hashing key design and time complexity.""",
                "max_marks": 10.0,
                "rubric_notes": "Award 6 marks for hash map using sorted string tuple or 26-char character count as dictionary key. Award 2 marks for handling empty strings and single character entries. Award 2 marks for complexity explanation (O(N * K log K) or O(N * K))."
            },

            # === 5 Theory / System Design Questions (6 marks each = 30 marks) ===
            {
                "type": QuestionType.CODE_DOC,
                "order_index": 16,
                "prompt": """### Conceptual Analysis 1: Relational Database Indexing & B-Trees
Explain in detail how a B-Tree index accelerates `SELECT ... WHERE column = ?` queries in a relational database.

**Address the following points:**
1. Why is B-Tree traversal faster than a full table scan?
2. Why does adding too many indexes degrade `INSERT`, `UPDATE`, and `DELETE` performance (Write Amplification & Page Splits)?""",
                "max_marks": 6.0,
                "rubric_notes": "Award 3 marks for explaining balanced tree O(log N) search and reduced disk block I/O reads. Award 3 marks for explaining write amplification, disk page splits, and secondary index maintenance overhead during write operations."
            },
            {
                "type": QuestionType.CODE_DOC,
                "order_index": 17,
                "prompt": """### Conceptual Analysis 2: Horizontal vs. Vertical Scaling & Stateless Architecture
Compare **Horizontal Scaling** (scaling out) vs **Vertical Scaling** (scaling up) for high-traffic web applications.

**Address the following points:**
1. Core architectural differences, cost scalability, and single points of failure.
2. Why backend application servers must be kept **stateless** (e.g., using Redis or JWT for sessions) to enable smooth load balancing.""",
                "max_marks": 6.0,
                "rubric_notes": "Award 3 marks for contrasting vertical CPU/RAM limits vs horizontal distributed elasticity and redundancy. Award 3 marks for explaining stateless app servers allowing round-robin / least-connection load balancing across instances."
            },
            {
                "type": QuestionType.CODE_DOC,
                "order_index": 18,
                "prompt": """### Conceptual Analysis 3: RESTful API Idempotency & Distributed Payment Safety
Define **Idempotency** in API design.

**Address the following scenario:**
When an e-commerce customer clicks \"Pay Now\", a network timeout occurs while the server is processing the payment. Explain how the client and server use an **Idempotency Key** to ensure the customer is never double-charged upon retrying the request.""",
                "max_marks": 6.0,
                "rubric_notes": "Award 3 marks for formal definition of idempotency. Award 3 marks for explaining the Idempotency Key workflow: unique client UUID, atomic DB check/lock, executing payment once, and caching the transaction response for retried requests."
            },
            {
                "type": QuestionType.CODE_DOC,
                "order_index": 19,
                "prompt": """### Conceptual Analysis 4: Strong Consistency vs. Eventual Consistency
Explain the trade-offs between **Strong Consistency** and **Eventual Consistency** in distributed databases according to the CAP theorem.

**Address the following points:**
1. How leader-follower replication lag impacts read consistency.
2. Provide one real-world software use case where Eventual Consistency is optimal, and one use case where Strong Consistency is strictly mandatory.""",
                "max_marks": 6.0,
                "rubric_notes": "Award 3 marks for explaining replica synchronization lag, read-your-writes guarantees, and latency/availability trade-offs. Award 3 marks for accurate real-world examples (e.g. social media feeds/like counters for eventual consistency vs financial ledgers/inventory checkout for strong consistency)."
            },
            {
                "type": QuestionType.CODE_DOC,
                "order_index": 20,
                "prompt": """### Conceptual Analysis 5: Microservices vs. Monoliths & Distributed Transactions
Discuss the architectural trade-offs between a **Monolithic Architecture** and a **Microservices Architecture**.

**Address the following points:**
1. Key benefits and operational challenges of microservices (e.g. service boundaries, network latency, observability).
2. How distributed transactions across microservices can be coordinated using the **Saga Pattern** (orchestrated or choreographed compensating transactions).""",
                "max_marks": 6.0,
                "rubric_notes": "Award 3 marks for comparing deployment isolation and team autonomy against network latency and distributed debugging. Award 3 marks for explaining the Saga pattern with local transactions and backward compensating transactions upon failure."
            }
        ]

        for q_data in questions_data:
            q = Question(
                exam_id=exam.id,
                type=q_data["type"],
                order_index=q_data["order_index"],
                prompt=q_data["prompt"],
                max_marks=q_data["max_marks"],
                mcq_options=q_data.get("mcq_options"),
                mcq_correct_key=q_data.get("mcq_correct_key"),
                rubric_notes=q_data.get("rubric_notes")
            )
            db.add(q)

        await db.commit()
        print(f"SUCCESS: Created 20-question assessment! Title: {exam.title}, Access Code: {exam.access_code}, Questions: {len(questions_data)}")

if __name__ == "__main__":
    asyncio.run(create_comprehensive_paper())
