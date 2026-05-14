from arguenet.agents import base

def test_build_personal_system_prompt():
    profile = {
        "name": "Test Agent",
        "background": "AI researcher",
        "hobbies": "Chess, Hiking",
        "interests": "AI, Philosophy",
        "beliefs": "Skeptical",
        "communication_style": "Direct"
    }
    prompt = base._build_personal_system_prompt(profile)
    assert "Test Agent" in prompt
    assert "AI researcher" in prompt
    assert "Chess" in prompt
    assert "Skeptical" in prompt
    assert "Direct" in prompt
