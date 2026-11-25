
def get_my_grades(student_id):
    grades = (
        Grade.query.filter_by(student_id=student_id)
        .options(joinedload(Grade.project).joinedload(Project.course))
        .order_by(Grade.updated_at.desc())
        .all()
    )

    serialized = []
    for grade in grades:
        item = _serialize_student_grade(grade)

        # Preserve the maximum grade information from main.
        item["max_grade"] = (
            float(grade.project.max_grade)
            if grade.project and grade.project.max_grade
            else 100.0
        )

        serialized.append(item)

    courses = (
        Course.query.join(
            CourseEnrollment,
            CourseEnrollment.course_id == Course.id,
        )
        .filter(CourseEnrollment.student_id == student_id)
        .options(selectinload(Course.projects))
        .order_by(Course.name.asc(), Course.id.asc())
        .all()
    )

    grouped_courses = []

    for course in courses:
        items = [
            item
            for item in serialized
            if item["course_id"] == course.id
        ]

        published_values = [
            item["grade"]
            for item in items
            if item["published"] and item["grade"] is not None
        ]

        grouped_courses.append(
            {
                "id": course.id,
                "name": course.name,
                "academic_year": course.academic_year,
                "semester": course.semester,
                "course_grade": (
                    round(
                        sum(published_values) / len(published_values),
                        2,
                    )
                    if published_values
                    else None
                ),
                "final_grade": None,
                "final_grade_available": False,
                "grades": items,
            }
        )

    return {
        "grades": serialized,
        "courses": grouped_courses,
    }
