
try:
    word_mrs = None
    user_threshold = 50
    print(f"Testing {word_mrs} >= {user_threshold}")
    result = word_mrs >= user_threshold
    print(f"Result: {result}")
except TypeError as e:
    print(f"Caught expected TypeError: {e}")

# Verify logic fix
mrs_from_dict = None
mrs_score = 100 if mrs_from_dict is None else mrs_from_dict
print(f"Fixed MRS: {mrs_score}")
result = mrs_score >= user_threshold
print(f"Fixed Result: {result}")
