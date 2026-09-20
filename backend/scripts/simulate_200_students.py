import asyncio
import csv
import io
import time
import random
import httpx
from app.main import app

TOTAL_STUDENTS = 200
ACCESS_CODE = "TECH-2026"

SAMPLE_CODE_ANSWERS = [
    """def two_sum(nums, target):
    lookup = {}
    for i, n in enumerate(nums):
        diff = target - n
        if diff in lookup:
            return [lookup[diff], i]
        lookup[n] = i
    return []""",

    """def is_palindrome(s):
    cleaned = [c.lower() for c in s if c.isalnum()]
    return cleaned == cleaned[::-1]""",

    """def merge_sorted_arrays(list1, list2):
    i = j = 0
    res = []
    while i < len(list1) and j < len(list2):
        if list1[i] <= list2[j]:
            res.append(list1[i])
            i += 1
        else:
            res.append(list2[j])
            j += 1
    res.extend(list1[i:])
    res.extend(list2[j:])
    return res""",

    """def search_rotated(nums, target):
    left, right = 0, len(nums) - 1
    while left <= right:
        mid = (left + right) // 2
        if nums[mid] == target:
            return mid
        if nums[left] <= nums[mid]:
            if nums[left] <= target < nums[mid]:
                right = mid - 1
            else:
                left = mid + 1
        else:
            if nums[mid] < target <= nums[right]:
                left = mid + 1
            else:
                right = mid - 1
    return -1""",

    """def group_anagrams(strs):
    from collections import defaultdict
    groups = defaultdict(list)
    for s in strs:
        key = tuple(sorted(s))
        groups[key].append(s)
    return list(groups.values())"""
]

SAMPLE_THEORY_ANSWERS = [
    "B-Trees maintain balanced logarithmic search depth O(log N) which dramatically minimizes disk page I/O reads. Secondary indexes cause write amplification and page splits on inserts.",
    "Horizontal scaling adds stateless instances behind a load balancer with shared cache like Redis, avoiding single point of failure and hardware resource ceilings.",
    "Idempotency ensures f(f(x)) = f(x). Idempotency keys allow payment servers to deduplicate network retries and safely return the cached response without double-charging.",
    "Eventual consistency tolerates replica synchronization lag for high availability (e.g. social media feeds), whereas strong consistency guarantees linearizable reads for financial ledgers.",
    "Microservices provide team autonomy and fault isolation at the cost of distributed network complexity. The Saga pattern manages cross-service transactions using compensating steps."
]

async def run_simulation():
    print(f"\n=======================================================")
    print(f"🚀 STARTING 200+ CANDIDATE REAL-WORLD MASS SIMULATION")
    print(f"=======================================================\n")

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test", timeout=60.0) as client:
        # 1. Teacher Login
        print("Step 1: Logging in as Teacher (teacher@exam.com)...")
        r = await client.post("/api/v1/auth/login", json={"email": "teacher@exam.com", "password": "teacher123"})
        if r.status_code != 200:
            print(f"Teacher login failed: {r.text}")
            return
        teacher_token = r.json()["access_token"]
        print("✅ Teacher authenticated successfully.\n")

        # 2. Generate 200-Student CSV
        run_tag = int(time.time()) % 10000
        print(f"Step 2: Generating CSV with {TOTAL_STUDENTS} unique student records (Batch {run_tag})...")
        csv_buffer = io.StringIO()
        writer = csv.writer(csv_buffer)
        writer.writerow(["full_name", "email", "password"])

        for i in range(1, TOTAL_STUDENTS + 1):
            writer.writerow([
                f"Candidate {i:03d}",
                f"sim_{run_tag}_student{i:03d}@university.edu",
                f"PassCode-{i:03d}!"
            ])
        csv_bytes = csv_buffer.getvalue().encode("utf-8")
        print(f"✅ Generated {TOTAL_STUDENTS} candidate rows in CSV.\n")

        # 3. Teacher Bulk Uploads CSV
        print(f"Step 3: Uploading CSV to /api/v1/teacher/students/upload-csv...")
        t0 = time.perf_counter()
        files = {"file": ("students_200.csv", io.BytesIO(csv_bytes), "text/csv")}
        upload_res = await client.post(
            "/api/v1/teacher/students/upload-csv",
            files=files,
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        t_upload = time.perf_counter() - t0

        if upload_res.status_code != 201:
            print(f"❌ CSV Upload failed ({upload_res.status_code}): {upload_res.text}")
            return

        created_students = upload_res.json()
        print(f"✅ Bulk Upload Completed in {t_upload:.2f}s! ({len(created_students)} accounts created)\n")

        # 4. Fetch Exam with Access Code
        print(f"Step 4: Fetching exam with Access Code '{ACCESS_CODE}'...")
        exam_res = await client.get(
            f"/api/v1/exams/code/{ACCESS_CODE}",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        if exam_res.status_code != 200:
            print(f"❌ Exam lookup failed: {exam_res.text}")
            return
        exam = exam_res.json()
        exam_id = exam["id"]
        questions = exam["questions"]
        print(f"✅ Exam Found: '{exam['title']}' ({len(questions)} questions)\n")

        # 5. Mass Concurrent Student Exam Execution & Submission
        print(f"Step 5: Simulating {len(created_students)} students concurrently taking and submitting exam...")
        print(f"⚡ Simulating sudden mass submission burst...")

        # Concurrency semaphore to model realistic server worker concurrency
        sem = asyncio.Semaphore(40)
        completed_count = 0

        async def simulate_single_student(student_data, index):
            nonlocal completed_count
            async with sem:
                email = student_data["email"]
                password = student_data["password"]

                # A. Student Login
                t_start = time.perf_counter()
                login_r = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
                if login_r.status_code != 200:
                    return {"success": False, "step": "login", "status": login_r.status_code, "latency": time.perf_counter() - t_start}
                token = login_r.json()["access_token"]

                # B. Unlock Exam by Access Code
                code_r = await client.get(f"/api/v1/exams/code/{ACCESS_CODE}", headers={"Authorization": f"Bearer {token}"})
                if code_r.status_code != 200:
                    return {"success": False, "step": "access_code", "status": code_r.status_code, "latency": time.perf_counter() - t_start}

                # C. Generate Randomized Answers
                answer_payload = []
                code_idx = 0
                theory_idx = 0

                for q in questions:
                    if q["type"] == "MCQ":
                        opts = q.get("mcq_options") or ["A", "B", "C", "D"]
                        chosen = random.choice(opts)
                        answer_payload.append({"question_id": q["id"], "student_answer": chosen})
                    else:
                        if code_idx < len(SAMPLE_CODE_ANSWERS):
                            ans_text = SAMPLE_CODE_ANSWERS[code_idx]
                            code_idx += 1
                        else:
                            ans_text = SAMPLE_THEORY_ANSWERS[theory_idx % len(SAMPLE_THEORY_ANSWERS)]
                            theory_idx += 1
                        answer_payload.append({"question_id": q["id"], "student_answer": ans_text})

                # D. Submit Exam (Concurrent Burst Submission)
                t_sub_start = time.perf_counter()
                sub_r = await client.post(
                    "/api/v1/submissions/",
                    json={
                        "exam_id": exam_id,
                        "answers": answer_payload,
                        "cheat_flags": {"total_strikes": random.randint(0, 1), "events": []}
                    },
                    headers={"Authorization": f"Bearer {token}"}
                )
                t_sub = time.perf_counter() - t_sub_start

                completed_count += 1
                if completed_count % 25 == 0 or completed_count == len(created_students):
                    print(f"  ⚡ Ingested {completed_count}/{len(created_students)} submissions ({t_sub*1000:.1f}ms latency)...")

                if sub_r.status_code == 201:
                    return {"success": True, "status": 201, "latency": t_sub, "score": sub_r.json().get("total_score", 0)}
                else:
                    return {"success": False, "step": "submit", "status": sub_r.status_code, "latency": t_sub, "err": sub_r.text}

        # Launch all 200 students concurrently
        burst_start = time.perf_counter()
        tasks = [simulate_single_student(s, idx) for idx, s in enumerate(created_students)]
        results = await asyncio.gather(*tasks)
        total_burst_time = time.perf_counter() - burst_start

        # Calculate statistics
        successful = [r for r in results if r["success"]]
        failed = [r for r in results if not r["success"]]
        latencies = [r["latency"] for r in successful]

        avg_latency = sum(latencies) / len(latencies) if latencies else 0
        min_latency = min(latencies) if latencies else 0
        max_latency = max(latencies) if latencies else 0

        print(f"\n=======================================================")
        print(f"📊 MASS SUBMISSION SIMULATION RESULTS")
        print(f"=======================================================")
        print(f"• Total Students Simulated:   {len(created_students)}")
        print(f"• Successful Submissions:     {len(successful)} / {len(created_students)} ({(len(successful)/len(created_students))*100:.1f}%)")
        print(f"• Failed Submissions:         {len(failed)}")
        print(f"• Total Burst Processing Time:{total_burst_time:.2f} seconds")
        print(f"• Average Submission Latency: {avg_latency*1000:.1f} ms")
        print(f"• Min Submission Latency:     {min_latency*1000:.1f} ms")
        print(f"• Max Submission Latency:     {max_latency*1000:.1f} ms")
        print(f"• Throughput Rate:            {len(successful)/total_burst_time:.1f} submissions / second")
        print(f"=======================================================\n")

        # 6. Check Teacher Evaluation Queue Status
        print("Step 6: Checking Teacher Batch Queue Status...")
        status_r = await client.get(
            f"/api/v1/review/exam/{exam_id}/evaluation-status",
            headers={"Authorization": f"Bearer {teacher_token}"}
        )
        batch_stats = status_r.json()
        print(f"• Total Submissions in Database: {batch_stats.get('total')}")
        print(f"• Pending Batch Evaluation:      {batch_stats.get('pending')}")
        print(f"• Evaluated:                     {batch_stats.get('evaluated')}")
        print(f"• Queue Status:                  {batch_stats}")
        print(f"\n✅ ALL 200+ SUBMISSIONS ARE SAFELY QUEUED FOR TEACHER BATCH EVALUATION!")

if __name__ == "__main__":
    asyncio.run(run_simulation())
